# app/routes/trades.py
from datetime import datetime
from utils.logger import log


def calculate_holding_period(trades):
    """
    Calculates holding period in days for a given list of trades.
    - For closed cycles (position goes from zero to nonzero back to zero):
        returns the duration of the last closed cycle.
    - For open positions (nonzero cumulative quantity at the end):
        returns the duration from the last time position was zero to today.
    """
    try:
        # Sort trades by date (assuming created_at is in "MM/DD/YYYY" format)
        sorted_trades = sorted(trades, key=lambda t: datetime.strptime(t['created_at'], "%m/%d/%Y"))
    except Exception as e:
        return None

    cumulative = 0
    current_cycle_start = None
    last_closed_cycle_duration = None

    for trade in sorted_trades:
        date = datetime.strptime(trade['created_at'], "%m/%d/%Y")
        # When cumulative is zero, a new cycle starts
        if cumulative == 0:
            current_cycle_start = date
        cumulative += trade.get('quantity', 0)
        # If cumulative returns to zero, we have a closed cycle
        if cumulative == 0 and current_cycle_start:
            last_closed_cycle_duration = (date - current_cycle_start).days
            current_cycle_start = None  # reset for next cycle

    if cumulative != 0 and current_cycle_start:
        # For an open position, calculate from the last cycle start until now.
        return (datetime.now() - current_cycle_start).days
    return last_closed_cycle_duration


def merge_trades(trades, merge_keys=None):
    """
    Merges trades into summary groups based on merge_keys.
    Uses the updated field name 'trade_type' instead of 'type'.

    For each group, computes:
      - total_quantity: net quantity (buys minus sells)
      - net_cost: signed sum of (quantity * price_per_unit)
      - last_price: price_per_unit of the most recent trade
      - current_price: current market price from the most recent trade (if available)
      - trade_count: number of trades in the group
      - holding_period: calculated via calculate_holding_period helper
      - For closed positions (total_quantity == 0):
            profit = -net_cost, profit_percentage = (profit / buy_amount)*100
      - For open positions (total_quantity != 0):
            cost_basis remains as net_cost; profit and profit_percentage are computed on the fly.
    """
    if merge_keys is None:
        merge_keys = ['ticker', 'source', 'trade_type']
    log.trace("Starting merge_trades with %d trades.", len(trades))

    # Normalize sell trades: ensure sell trades have negative quantity.
    for idx, trade in enumerate(trades):
        if trade.get('transaction_type', '').lower() == 'sell' and trade.get('quantity', 0) > 0:
            original_qty = trade.get('quantity', 0)
            trade['quantity'] = -abs(original_qty)
            log.trace("Normalized sell trade at index %d: %s -> %s", idx, original_qty, trade['quantity'])

    summary = {}
    for idx, trade in enumerate(trades):
        created_at_str = trade.get('created_at')
        try:
            trade_date = datetime.strptime(created_at_str, "%m/%d/%Y")
            log.trace("Parsed date for trade %d: %s", idx, trade_date)
        except Exception as e:
            trade_date = None
            log.info("Failed to parse date '%s' for trade index %d: %s", created_at_str, idx, e)

        key = tuple(trade.get(k) for k in merge_keys)
        if key not in summary:
            summary[key] = {
                'ticker': trade.get('ticker'),
                'source': trade.get('source'),
                'trade_type': trade.get('trade_type'),
                'total_quantity': 0,
                'netCost': 0,
                'last_price': None,
                'current_price': None,  # will be updated from the trade's field if available
                'trade_count': 0,
                'holding_period': None,
                'profit': None,
                'profit_percentage': None,
                'buy_amount': 0,  # for computing profit percentage in closed positions
                'trades': []
            }
            log.trace("Created new summary group for key: %s", key)

        group = summary[key]
        qty = trade.get('quantity', 0)
        price = trade.get('price_per_unit', 0)
        log.trace("Trade %d: quantity=%s, price_per_unit=%s", idx, qty, price)

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

    # For each group, compute derived metrics.
    for key, data in summary.items():
        data['holding_period'] = calculate_holding_period(data['trades'])
        if data['total_quantity'] == 0:
            # Closed position: realized profit = -netCost, profit percentage = profit / buyAmount * 100
            data['profit'] = round(-data['netCost'], 2)
            if data['buy_amount'] != 0:
                data['profit_percentage'] = round((data['profit'] / data['buy_amount']) * 100, 2)
            data['total_cost'] = round(-data['net_cost'], 2)
            log.trace("Closed position key %s: profit=%s, profit_percentage=%s", key, data['profit'],
                      data.get('profit_percentage'))
        else:
            # Open position: cost basis remains netCost. Profit and profitPercentage will be computed on the fly.
            data['total_cost'] = data['net_cost']
            if data.get('current_price') is not None:
                avg_cost = data['total_cost'] / data['total_quantity']
                if data['total_quantity'] > 0:
                    profit = (data['current_price'] - avgCost) * data['total_quantity']
                    profit_percentage = ((data['current_price'] / avgCost) - 1) * 100
                elif data['total_quantity'] < 0:
                    profit = (avgCost - data['current_price']) * abs(data['total_quantity'])
                    profit_percentage = ((avgCost / data['currentPrice']) - 1) * 100
                data['profit'] = round(profit, 2)
                data['profit_percentage'] = round(profit_percentage, 2)
                log.trace("Open position key %s: current_price=%s, avg_cost=%s, profit=%s, profit_percentage=%s",
                          key, data['current_price'], avgCost, data['profit'], data['profit_percentage'])
            else:
                data['profit'] = None
                data['profit_percentage'] = None
        # Remove temporary fields.
        if 'buy_amount' in data:
            del data['buy_amount']
        if 'earliest_date' in data:
            del data['earliest_date']
        if 'latest_date' in data:
            del data['latest_date']
        if 'net_cost' in data:
            del data['net_cost']

    log.info("Completed merge_trades for %d groups.", len(summary))
    return list(summary.values())


def calculate_closed_position(group):
    """
    Helper for closed positions (totalQuantity == 0).
    Returns a tuple: (net_cost, profit, profit_percentage).
    """
    net_cost = group.get("total_cost", 0)
    profit = group.get("profit", 0)
    profit_percentage = group.get("profit_percentage", 0)
    return net_cost, profit, profit_percentage


def calculate_open_position(group):
    """
    Helper for open positions (totalQuantity != 0).
    Calculates market value on the fly using currentPrice.
    Returns a tuple: (market_value, profit, profit_percentage).
    """
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
            # Use currentPrice if available; if not, fallback to lastPrice
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

    overall_profit_percentage = round((overall_profit / overall_buy_amount) * 100, 2) if overall_buy_amount else None
    return overall_net_cash, overall_profit, overall_profit_percentage
