# services/trade_holdings.py
from datetime import datetime

from app.database import db
from app.models import UnrealizedHolding
from utils.logger import log


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
          * If the new net_quantity becomes 0, then set close_date and deleted_at to the trade’s date and set
          average_cost to the trade’s price.
      - Otherwise, create a new holding with open_date set to the trade’s date.

    Finally, assign the holding’s id to new_trade.holding_id.
    """
    log.debug(f"Processing new trade {new_trade.id} for holding update.")
    # Determine effective quantity (sell trades become negative).
    effective_quantity = new_trade.quantity
    if new_trade.transaction_type.lower() == "sell":
        effective_quantity = -abs(new_trade.quantity)

    trade_value = effective_quantity * new_trade.price_per_unit

    # Query for an active holding (close_date is NULL).
    holding = UnrealizedHolding.query.filter_by(
        ticker=new_trade.ticker,
        source=new_trade.source,
        trade_type=new_trade.trade_type,
        close_date=None,
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
                    old_quantity * holding.average_cost
                    + effective_quantity * new_trade.price_per_unit
                ) / (old_quantity + effective_quantity)
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
            deleted_at=None,
        )
        db.session.add(holding)
        db.session.flush()  # Ensure holding.id is assigned.

    # Link the trade to the holding.
    new_trade.holding_id = holding.id
    db.session.add(new_trade)
    log.debug(f"Updated holding {holding.id} with trade {new_trade.id}.")
    return holding


def process_new_trade(new_trade):
    """
    Process a new trade by updating its associated unrealized holding.
    """
    return update_unrealized_holding(new_trade)


def get_holding_period(holding):
    """
    Returns the holding period (in days) based on the holding's open_date and close_date.
    If the holding is still open (close_date is None), returns the period from open_date until now.
    """
    if holding.close_date:
        return (holding.close_date - holding.open_date).days
    return (datetime.utcnow() - holding.open_date).days


def get_profit(holding):
    """
    Computes profit as (latest_trade_price - average_cost) * net_quantity.
    For short positions (net_quantity negative) this calculation should reflect profit/loss appropriately.
    """
    return (holding.latest_trade_price - holding.average_cost) * holding.net_quantity


def get_profit_percentage(holding):
    """
    Computes the profit percentage relative to the total cost basis (net_cost).
    Returns None if net_cost is zero.
    """
    if holding.net_cost:
        return ((get_profit(holding)) / abs(holding.net_cost)) * 100
    return None
