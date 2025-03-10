# services/trade_holdings.py

from datetime import datetime
from app.models import UnrealizedHolding, Trade
from app.database import db


def update_unrealized_holding(new_trade):
    """
    Update or create an unrealized holding based on the new trade.

    Assumes holdings are tracked only while open (i.e. close_date is NULL) and uses:
      - open_date: the date when the holding was originally opened.
      - close_date: the date when the holding was closed (net_quantity reached 0).
      - deleted_at: set when the holding is closed.
      - latest_trade_price: always updated to the current trade's price.

    The effective quantity is calculated as:
      - For buy trades: positive quantity.
      - For sell trades: negative quantity.

    Logic:
      - If an active holding exists:
          * Update net_quantity = old_quantity + effective_quantity.
          * Increase net_cost by (effective_quantity * trade price).
          * For buy trades, recalc weighted average cost (if the holding remains open).
          * Always update latest_trade_price to the new trade's price.
          * If the new net_quantity becomes 0, then set close_date and deleted_at to the trade’s date and set average_cost to the trade’s price.
      - Otherwise, create a new holding with open_date set to the trade’s date.

    Finally, assign the holding’s id to new_trade.holding_id.
    """
    # Determine effective quantity (sell trades become negative).
    effective_quantity = new_trade.quantity
    if new_trade.transaction_type.lower() == 'sell':
        effective_quantity = -abs(new_trade.quantity)

    trade_value = effective_quantity * new_trade.price_per_unit

    # Query for an active holding (close_date is NULL).
    holding = UnrealizedHolding.query.filter_by(
        ticker=new_trade.ticker,
        source=new_trade.source,
        trade_type=new_trade.trade_type,
        close_date=None
    ).first()

    if holding:
        old_quantity = holding.net_quantity
        new_quantity = old_quantity + effective_quantity

        # Always update latest_trade_price to the current trade's price.
        holding.latest_trade_price = new_trade.price_per_unit

        # Increase net_cost by the cost impact of the trade.
        holding.net_cost += trade_value

        # For buy trades, update weighted average cost if the holding remains open.
        if effective_quantity > 0:
            if old_quantity > 0:
                holding.average_cost = (
                        (old_quantity * holding.average_cost + effective_quantity * new_trade.price_per_unit)
                        / (old_quantity + effective_quantity)
                )
            else:
                # If no prior buy quantity exists, set to new trade price.
                holding.average_cost = new_trade.price_per_unit

        holding.net_quantity = new_quantity

        if new_quantity == 0:
            # Holding is now closed.
            holding.close_date = new_trade.trade_date
            holding.deleted_at = new_trade.trade_date
            # When closed, set average_cost to the trade's price.
            holding.average_cost = new_trade.price_per_unit

        db.session.add(holding)
    else:
        # No active holding exists: create a new one.
        holding = UnrealizedHolding(
            ticker=new_trade.ticker,
            source=new_trade.source,
            trade_type=new_trade.trade_type,
            net_quantity=effective_quantity,
            average_cost=new_trade.price_per_unit,
            net_cost=trade_value,
            latest_trade_price=new_trade.price_per_unit,
            open_date=new_trade.trade_date,
            close_date=None,
            deleted_at=None
        )
        db.session.add(holding)
        db.session.flush()  # Ensure holding.id is assigned.

    # Link the trade to the holding.
    new_trade.holding_id = holding.id
    db.session.add(new_trade)
    return holding


def process_new_trade(new_trade):
    """
    Process a new trade by updating its associated unrealized holding.
    """
    return update_unrealized_holding(new_trade)


def calculate_holding_period(trades):
    """
    Calculates holding period in days for a given list of trades.
    For closed cycles, returns the duration of the last closed cycle.
    For open positions, returns the duration from the last time the position was zero until now.
    """
    try:
        sorted_trades = sorted(trades, key=lambda t: datetime.strptime(t['created_at'], "%m/%d/%Y"))
    except Exception:
        return None

    cumulative = 0
    current_cycle_start = None
    last_closed_cycle_duration = None

    for trade in sorted_trades:
        date = datetime.strptime(trade['created_at'], "%m/%d/%Y")
        if cumulative == 0:
            current_cycle_start = date
        cumulative += trade.get('quantity', 0)
        if cumulative == 0 and current_cycle_start:
            last_closed_cycle_duration = (date - current_cycle_start).days
            current_cycle_start = None

    if cumulative != 0 and current_cycle_start:
        return (datetime.now() - current_cycle_start).days
    return last_closed_cycle_duration


def merge_trades(trades, merge_keys=None):
    """
    Merges trades into summary groups based on merge_keys.
    Uses the updated field name 'trade_type'.

    Computes group-level metrics including:
      - total_quantity (net quantity),
      - net_cost,
      - last trade price,
      - holding_period (via calculate_holding_period),
      and profit metrics.
    """
    if merge_keys is None:
        merge_keys = ['ticker', 'source', 'trade_type']

    for idx, trade in enumerate(trades):
        if trade.get('transaction_type', '').lower() == 'sell' and trade.get('quantity', 0) > 0:
            trade['quantity'] = -abs(trade.get('quantity', 0))

    summary = {}
    for idx, trade in enumerate(trades):
        created_at_str = trade.get('created_at')
        try:
            trade_date = datetime.strptime(created_at_str, "%m/%d/%Y")
        except Exception:
            trade_date = None

        key = tuple(trade.get(k) for k in merge_keys)
        if key not in summary:
            summary[key] = {
                'ticker': trade.get('ticker'),
                'source': trade.get('source'),
                'trade_type': trade.get('trade_type'),
                'total_quantity': 0,
                'net_cost': 0,
                'last_price': None,
                'current_price': None,
                'trade_count': 0,
                'holding_period': None,
                'profit': None,
                'profit_percentage': None,
                'buy_amount': 0,
                'trades': []
            }

        group = summary[key]
        qty = trade.get('quantity', 0)
        price = trade.get('price_per_unit', 0)
        group['net_cost'] += qty * price
        group['total_quantity'] += qty
        group['trade_count'] += 1
        if trade.get('transaction_type', '').lower() == 'buy':
            group['buy_amount'] += qty * price
        group['trades'].append(trade)
        if trade_date:
            if group.get('earliest_date') is None or trade_date < group.get('earliest_date'):
                group['earliest_date'] = trade_date
            if group.get('latest_date') is None or trade_date >= group.get('latest_date'):
                group['latest_date'] = trade_date
                group['last_price'] = price
                group['current_price'] = trade.get('current_price', None)

    for key, data in summary.items():
        data['holding_period'] = calculate_holding_period(data['trades'])
        if data['total_quantity'] == 0:
            data['profit'] = round(-data['net_cost'], 2)
            if data['buy_amount'] != 0:
                data['profit_percentage'] = round((data['profit'] / data['buy_amount']) * 100, 2)
            data['total_cost'] = round(-data['net_cost'], 2)
        else:
            data['total_cost'] = data['net_cost']
            if data.get('current_price') is not None:
                avg_cost = data['total_cost'] / data['total_quantity']
                if data['total_quantity'] > 0:
                    profit = (data['current_price'] - avg_cost) * data['total_quantity']
                    profit_percentage = ((data['current_price'] / avg_cost) - 1) * 100
                elif data['total_quantity'] < 0:
                    profit = (avg_cost - data['current_price']) * abs(data['total_quantity'])
                    profit_percentage = ((avg_cost / data['current_price']) - 1) * 100
                data['profit'] = round(profit, 2)
                data['profit_percentage'] = round(profit_percentage, 2)
            else:
                data['profit'] = None
                data['profit_percentage'] = None
        for temp_field in ['buy_amount', 'earliest_date', 'latest_date', 'net_cost']:
            if temp_field in data:
                del data[temp_field]

    return list(summary.values())


def calculate_closed_position(group):
    net_cost = group.get("total_cost", 0)
    profit = group.get("profit", 0)
    profit_percentage = group.get("profit_percentage", 0)
    return net_cost, profit, profit_percentage


def calculate_open_position(group):
    quantity = group.get("total_quantity", 0)
    current_price = group.get("current_price") or group.get("last_price", 0)
    cost_basis = group.get("total_cost", 0)
    market_value = current_price * quantity
    profit = market_value - cost_basis
    if quantity > 0 and cost_basis != 0:
        profit_percentage = ((current_price / (cost_basis / quantity)) - 1) * 100
    elif quantity < 0 and current_price != 0:
        profit_percentage = ((cost_basis / quantity / current_price) - 1) * 100
    else:
        profit_percentage = 0
    return market_value, profit, profit_percentage


def aggregate_overall_metrics(merged_data):
    overall_net_cash = 0
    overall_profit = 0
    overall_buy_amount = 0

    for group in merged_data:
        quantity = group.get("total_quantity", 0)
        if quantity == 0:
            net_cash, profit, _ = calculate_closed_position(group)
        else:
            cp = group.get("current_price") or group.get("last_price", 0)
            net_cash = cp * quantity
            _, profit, _ = calculate_open_position(group)
        overall_net_cash += net_cash
        overall_profit += profit

        group_buy_amount = sum(
            t['quantity'] * t['price_per_unit']
            for t in group.get('trades', [])
            if t.get('transaction_type', '').lower() == 'buy'
        )
        overall_buy_amount += group_buy_amount

    overall_profit_percentage = (
        round((overall_profit / overall_buy_amount) * 100, 2)
        if overall_buy_amount else None
    )
    return overall_net_cash, overall_profit, overall_profit_percentage
