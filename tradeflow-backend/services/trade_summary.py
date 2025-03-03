# app/routes/trades.py
from datetime import datetime
from utils.logger import log


def calculate_holding_period(trades):
    """
    Calculates holding period in days for a given list of trades.
    - For closed cycles (position goes from zero to nonzero back to zero): returns the duration of the last closed cycle.
    - For open positions (nonzero cumulative quantity at the end): returns the duration from the last time position was zero to today.
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
        # If the position is currently zero, mark the start of a new cycle.
        if cumulative == 0:
            current_cycle_start = date
        cumulative += trade.get('quantity', 0)
        # If the cumulative sum returns to zero, mark a closed cycle.
        if cumulative == 0 and current_cycle_start:
            last_closed_cycle_duration = (date - current_cycle_start).days
            current_cycle_start = None  # reset for any new cycle

    # For an open position, calculate from the last cycle start until now.
    if cumulative != 0 and current_cycle_start:
        return (datetime.now() - current_cycle_start).days
    return last_closed_cycle_duration


def merge_trades(trades, merge_keys=['ticker', 'source', 'type']):
    """
    Merges trades into summary groups based on merge_keys.

    For each group, computes:
      - totalQuantity: net quantity (buys minus sells)
      - netCost: sum(quantity * price_per_unit) using signed quantities.
                 (For closed positions, we display totalCost as -netCost so that
                  profit = -netCost and totalCost have the same sign.)
      - lastPrice: the price_per_unit of the most recent trade (by created_at)
      - currentPrice: the current market price from the most recent trade.
      - tradeCount: the number of trades in the group
      - holdingPeriod: difference in days between the earliest and latest trade dates
      - For closed positions (totalQuantity == 0):
            * profit = -netCost
            * profitPercentage = (profit / (sum of buy amounts)) * 100
      - For open positions (totalQuantity != 0):
            * totalCost remains as computed (netCost)
            * profit = (currentPrice - avgCost) * totalQuantity  for long positions,
              or (avgCost - currentPrice) * abs(totalQuantity) for short positions.
            * profitPercentage = ((currentPrice/avgCost)-1)*100 for longs,
              or ((avgCost/currentPrice)-1)*100 for shorts.
    """
    log.trace("Starting merge_trades with %d trades.", len(trades))

    # Normalize sell trades (ensure they have negative quantity)
    for idx, trade in enumerate(trades):
        if trade.get('transaction_type', '').lower() == 'sell' and trade.get('quantity', 0) > 0:
            original_qty = trade.get('quantity', 0)
            trade['quantity'] = -abs(original_qty)
            log.trace("Normalized sell trade at index %d: quantity %s -> %s", idx, original_qty, trade['quantity'])

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
                'type': trade.get('type'),
                'totalQuantity': 0,
                'netCost': 0,  # signed sum of (quantity * price_per_unit)
                'lastPrice': None,
                'currentPrice': None,  # will update from the most recent trade
                'tradeCount': 0,
                'holdingPeriod': None,
                'profit': None,
                'profitPercentage': None,
                'buyAmount': 0,  # Sum of amounts for buy trades (for profit percentage in closed positions)
                'earliestDate': trade_date,
                'latestDate': trade_date,
                'trades': []
            }
            log.trace("Created new summary group for key: %s", key)

        group = summary[key]
        qty = trade.get('quantity', 0)
        price = trade.get('price_per_unit', 0)
        log.trace("Trade %d: quantity=%s, price_per_unit=%s", idx, qty, price)

        # Accumulate net cost using signed amounts
        group['netCost'] += qty * price
        group['totalQuantity'] += qty
        group['tradeCount'] += 1

        # Accumulate buy amount (only for buy trades)
        if trade.get('transaction_type', '').lower() == 'buy':
            group['buyAmount'] += qty * price

        # Update earliest and latest dates, lastPrice, and currentPrice.
        if trade_date:
            if group['earliestDate'] is None or trade_date < group['earliestDate']:
                group['earliestDate'] = trade_date
                log.trace("Updated earliestDate for key %s: %s", key, trade_date)
            if group['latestDate'] is None or trade_date >= group['latestDate']:
                group['latestDate'] = trade_date
                group['lastPrice'] = price
                # Update currentPrice from the trade's field
                group['currentPrice'] = trade.get('currentPrice', None)
                log.trace("Updated latestDate, lastPrice, and currentPrice for key %s: %s, price %s, currentPrice %s", key, trade_date, price, group['currentPrice'])
        else:
            if group['lastPrice'] is None:
                group['lastPrice'] = price
                group['currentPrice'] = trade.get('currentPrice', None)
                log.trace("Set lastPrice and currentPrice for key %s with no valid date: %s, currentPrice %s", key, price, group['currentPrice'])

        group['trades'].append(trade)
        log.trace("After processing trade %d for key %s: totalQuantity=%s, netCost=%s", idx, key, group['totalQuantity'], group['netCost'])

    # Compute derived metrics for each group.
    for key, data in summary.items():
        # Compute holding period using the helper method that analyzes trade cycles.
        data['holdingPeriod'] = calculate_holding_period(data['trades'])
        log.trace("Computed holdingPeriod for key %s: %s days", key, data['holdingPeriod'])

        if data['totalQuantity'] == 0:
            # Closed position: compute realized profit.
            data['profit'] = round(-data['netCost'], 2)
            if data['buyAmount'] != 0:
                data['profitPercentage'] = round((data['profit'] / data['buyAmount']) * 100, 2)
            # Adjust displayed total cost to have the same sign as profit.
            data['totalCost'] = round(-data['netCost'], 2)
            log.trace("For closed position key %s: profit=%s, profitPercentage=%s", key, data['profit'], data['profitPercentage'])
        else:
            # Open position: use currentPrice to compute profit if available.
            data['totalCost'] = data['netCost']
            if data.get('currentPrice') is not None:
                # Calculate average cost per unit
                avgCost = data['totalCost'] / data['totalQuantity']
                if data['totalQuantity'] > 0:
                    profit = (data['currentPrice'] - avgCost) * data['totalQuantity']
                    profitPercentage = ((data['currentPrice'] / avgCost) - 1) * 100
                elif data['totalQuantity'] < 0:
                    profit = (avgCost - data['currentPrice']) * abs(data['totalQuantity'])
                    profitPercentage = ((avgCost / data['currentPrice']) - 1) * 100
                data['profit'] = round(profit, 2)
                data['profitPercentage'] = round(profitPercentage, 2)
                log.trace("For open position key %s: currentPrice=%s, avgCost=%s, profit=%s, profitPercentage=%s", key, data['currentPrice'], avgCost, data['profit'], data['profitPercentage'])
            else:
                data['profit'] = None
                data['profitPercentage'] = None
                log.trace("Open position key %s: currentPrice not available, no profit calculation", key)

        # Remove temporary fields.
        del data['buyAmount']
        del data['earliestDate']
        del data['latestDate']
        del data['netCost']

    log.info("Completed merge_trades for %d groups.", len(summary))
    return list(summary.values())
