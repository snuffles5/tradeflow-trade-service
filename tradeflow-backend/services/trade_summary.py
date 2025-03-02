from datetime import datetime
from utils.logger import log

def merge_trades(trades, merge_keys=['ticker', 'source', 'type']):
    """
    Merges trades into summary groups based on merge_keys.
    Computes metrics such as totalQuantity, totalCost, lastPrice, tradeCount,
    holdingPeriod, profit, and profitPercentage.
    """
    log.trace("Starting merge_trades with %d trades.", len(trades))

    # Normalize sell trades
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

        log.trace("Trade %d: price_per_unit=%s", idx, trade.get('price_per_unit'))
        key = tuple(trade.get(k) for k in merge_keys)
        if key not in summary:
            summary[key] = {
                'ticker': trade.get('ticker'),
                'source': trade.get('source'),
                'type': trade.get('type'),
                'totalQuantity': 0,
                'totalCost': 0,
                'lastPrice': None,
                'tradeCount': 0,
                'holdingPeriod': None,
                'profit': None,
                'profitPercentage': None,
                'buyAmount': 0,  # Sum of amounts for buy trades (for profit percentage)
                'earliestDate': trade_date,
                'latestDate': trade_date,
                'trades': []
            }
            log.trace("Created new summary group for key: %s", key)

        group = summary[key]
        qty = trade.get('quantity', 0)
        price = trade.get('price_per_unit', 0)

        group['totalQuantity'] += qty
        group['totalCost'] += qty * price  # Note: sells are negative
        group['tradeCount'] += 1

        if trade.get('transaction_type', '').lower() == 'buy':
            group['buyAmount'] += qty * price

        # Update earliest and latest dates and lastPrice
        if trade_date:
            if group['earliestDate'] is None or trade_date < group['earliestDate']:
                group['earliestDate'] = trade_date
                log.trace("Updated earliestDate for key %s: %s", key, trade_date)
            if group['latestDate'] is None or trade_date >= group['latestDate']:
                group['latestDate'] = trade_date
                group['lastPrice'] = price
                log.trace("Updated latestDate and lastPrice for key %s: %s, price %s", key, trade_date, price)
        else:
            if group['lastPrice'] is None:
                group['lastPrice'] = price
                log.trace("Set lastPrice for key %s with no valid date: %s", key, price)

        group['trades'].append(trade)
        log.trace("After processing trade %d for key %s: totalQuantity=%s, totalCost=%s", idx, key, group['totalQuantity'], group['totalCost'])

    # Compute derived metrics for each group
    for key, data in summary.items():
        if data['earliestDate'] and data['latestDate']:
            data['holdingPeriod'] = (data['latestDate'] - data['earliestDate']).days
            log.trace("Computed holdingPeriod for key %s: %d days", key, data['holdingPeriod'])

        if data['totalQuantity'] == 0:  # Closed position
            data['profit'] = round(-data['totalCost'], 2)
            if data['buyAmount'] != 0:
                data['profitPercentage'] = round((data['profit'] / data['buyAmount']) * 100, 2)
            log.trace("For closed position key %s: profit=%s, profitPercentage=%s", key, data['profit'], data['profitPercentage'])
        else:
            # For open positions, no profit calculation is done.
            log.trace("Open position key %s: no profit calculation (profit remains None)", key)

        # Log final computed values for the group
        log.trace("Final group for key %s: totalCost=%s, lastPrice=%s", key, data['totalCost'], data['lastPrice'])

        # Remove temporary fields
        del data['buyAmount']
        del data['earliestDate']
        del data['latestDate']

    log.info("Completed merge_trades for %d groups.", len(summary))
    return list(summary.values())
