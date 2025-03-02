# trade_summary.py
def merge_trades(trades, merge_keys=['ticker', 'source', 'type']):
    """
    Merges trades into summary groups based on merge_keys.

    For open positions (totalQuantity != 0):
      - avgPrice = totalCost / totalQuantity
      - profit = totalQuantity * (currentPrice - avgPrice)

    For closed positions (totalQuantity == 0):
      - profit is set to totalCost (i.e. the net difference between buys and sells)

    trades: list of dicts representing individual trades.
    merge_keys: list of keys on which to group trades.

    Returns a list of summary dicts.
    """
    # First, normalize sell trades (if needed)
    for trade in trades:
        # If transaction_type is sell and quantity is positive, make it negative.
        if trade.get('transaction_type', '').lower() == 'sell' and trade.get('quantity', 0) > 0:
            trade['quantity'] = -abs(trade.get('quantity', 0))

    summary = {}
    for trade in trades:
        # Create a composite key from the merge keys
        key = tuple(trade.get(k) for k in merge_keys)
        if key not in summary:
            summary[key] = {
                'ticker': trade.get('ticker'),
                'source': trade.get('source'),
                'type': trade.get('type'),
                'totalQuantity': 0,
                'totalCost': 0,
                'avgPrice': None,
                'currentPrice': trade.get('currentPrice'),  # assume same for group
                'profit': None,
                'trades': []
            }
        quantity = trade.get('quantity', 0)
        price_per_unit = trade.get('pricePerUnit', 0)
        summary[key]['totalQuantity'] += quantity
        summary[key]['totalCost'] += quantity * price_per_unit
        summary[key]['trades'].append(trade)

    # Compute summary metrics and profit
    for key, data in summary.items():
        if data['totalQuantity'] != 0:
            data['avgPrice'] = data['totalCost'] / data['totalQuantity']
            if data['currentPrice'] is not None:
                data['profit'] = round(data['totalQuantity'] * (data['currentPrice'] - data['avgPrice']), 2)
        else:
            # For a closed position, where totalQuantity == 0,
            # we define profit as the totalCost (net difference between buys and sells)
            data['profit'] = round(data['totalCost'], 2)
    return list(summary.values())
