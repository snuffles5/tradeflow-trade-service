# services/trade_holdings.py
from datetime import datetime

from app.database import db
from app.models import TradeOwner
from app.models import TradeSource
from app.models import TradeTransactionType
from app.models import UnrealizedHolding
from exceptions import HoldingRetrievalError
from exceptions import TradeNotFoundException
from exceptions import UnrealizedHoldingRecalculationError
from services.db_queries import get_active_holding
from services.db_queries import get_holding_by_id
from services.db_queries import get_trade_by_id
from services.db_queries import get_trades_by_holding_id
from utils.logger import log


def update_unrealized_holding(new_trade):
    """
    Update or create an unrealized holding based on the new trade.

    Assumes holdings are tracked only while open (i.e. close_date is NULL) and uses:
      - open_date: the date when the holding was originally opened.
      - close_date: the date when the holding was closed (net_quantity reached 0).
      - deleted_at: set when the holding is closed.
      - latest_trade_price: always updated to the current trade's price.

    Finally, assigns the holding's id to new_trade.holding_id.
    """
    log.debug(f"Processing new trade {new_trade.id} for holding update.")
    effective_quantity = new_trade.quantity
    if new_trade.transaction_type == TradeTransactionType.sell:
        effective_quantity = -abs(new_trade.quantity)
    trade_value = effective_quantity * new_trade.price_per_unit

    # Fetch active holding based on owner and source IDs from the trade object
    response = get_active_holding(
        new_trade.ticker, new_trade.trade_source_id, new_trade.trade_owner_id
    )
    if not response.success:
        raise HoldingRetrievalError(response.error_message)
    holding = response.data  # may be None if not found

    if holding:
        old_quantity = holding.net_quantity
        new_quantity = old_quantity + effective_quantity
        holding.latest_trade_price = new_trade.price_per_unit
        holding.net_cost += trade_value
        if effective_quantity > 0:
            if old_quantity > 0:
                holding.average_cost = (
                    old_quantity * holding.average_cost
                    + effective_quantity * new_trade.price_per_unit
                ) / (old_quantity + effective_quantity)
            else:
                holding.average_cost = new_trade.price_per_unit
        holding.net_quantity = new_quantity
        if new_quantity == 0:
            holding.close_date = new_trade.trade_date
            holding.deleted_at = new_trade.trade_date
            holding.average_cost = new_trade.price_per_unit
        db.session.add(holding)
    else:
        # Create holding using owner and source IDs from the trade object
        holding = UnrealizedHolding(
            ticker=new_trade.ticker,
            trade_source_id=new_trade.trade_source_id,
            trade_owner_id=new_trade.trade_owner_id,
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
    For short positions (net_quantity negative) this calculation reflects profit/loss appropriately.
    """
    return (holding.latest_trade_price - holding.average_cost) * holding.net_quantity


def get_profit_percentage(holding):
    """
    Computes the profit percentage relative to the total cost basis (net_cost).
    Returns None if net_cost is zero.
    """
    if holding.net_cost:
        return (get_profit(holding) / abs(holding.net_cost)) * 100
    return None


def recalc_unrealized_holding(holding):
    """
    Recalculate the unrealized holding based on all trades associated with it.

    This function queries all trades linked to the holding (via holding_id) and recomputes:
      - net_quantity
      - net_cost
      - weighted average_cost (based on buy trades)
      - latest_trade_price, open_date, and if applicable, close_date and deleted_at.

    If no trades remain for this holding, the holding is removed.
    """
    response = get_trades_by_holding_id(holding.id)
    if not response.success:
        raise UnrealizedHoldingRecalculationError(response.error_message)
    trades = response.data

    if not trades:
        holding.soft_delete()
        db.session.flush()
        return None

    net_quantity = 0
    net_cost = 0
    total_buy_quantity = 0
    total_buy_cost = 0
    open_date = trades[0].trade_date
    latest_trade_date = trades[-1].trade_date

    for trade in trades:
        effective_quantity = trade.quantity
        if trade.transaction_type == TradeTransactionType.sell:
            effective_quantity = -abs(trade.quantity)
        net_quantity += effective_quantity
        trade_value = effective_quantity * trade.price_per_unit
        net_cost += trade_value
        if trade.transaction_type == TradeTransactionType.buy:
            total_buy_quantity += trade.quantity
            total_buy_cost += trade.quantity * trade.price_per_unit

    average_cost = (
        (total_buy_cost / total_buy_quantity)
        if total_buy_quantity > 0
        else trades[-1].price_per_unit
    )

    holding.net_quantity = net_quantity
    holding.net_cost = net_cost
    holding.average_cost = average_cost
    holding.latest_trade_price = trades[-1].price_per_unit
    holding.open_date = open_date

    if net_quantity == 0:
        holding.close_date = latest_trade_date
        holding.deleted_at = latest_trade_date
    else:
        holding.close_date = None
        holding.deleted_at = None

    db.session.add(holding)
    db.session.flush()
    return holding


def update_existing_trade(updated_trade_data):
    """
    Update an existing trade and recalculate its associated unrealized holding.

    Args:
        updated_trade_data (dict): Dictionary containing updated trade fields including
                                   trade_id, trade_owner_id, trade_source_id, etc.
    """
    trade_id = updated_trade_data.get("id")
    response_trade = get_trade_by_id(trade_id)
    if not response_trade.success:
        log.error(f"Trade {trade_id} not found for update.")
        raise TradeNotFoundException(response_trade.error_message)
    trade = response_trade.data

    old_holding_id = trade.holding_id  # Keep track of the old holding

    # Validate owner and source IDs
    new_owner_id = updated_trade_data.get("trade_owner_id")
    new_source_id = updated_trade_data.get("trade_source_id")

    owner = db.session.get(TradeOwner, new_owner_id)
    source = db.session.get(TradeSource, new_source_id)

    if not owner:
        raise ValueError(f"TradeOwner with id {new_owner_id} not found")
    if not source:
        raise ValueError(f"TradeSource with id {new_source_id} not found")

    # Validate association
    if owner not in source.owners:
        raise ValueError(
            f"TradeOwner '{owner.name}' is not valid for TradeSource '{source.name}'"
        )

    # Update trade fields from the input dictionary
    trade.quantity = updated_trade_data.get("quantity", trade.quantity)
    trade.price_per_unit = updated_trade_data.get(
        "price_per_unit", trade.price_per_unit
    )
    trade.trade_date = updated_trade_data.get("trade_date", trade.trade_date)
    trade.transaction_type = updated_trade_data.get(
        "transaction_type", trade.transaction_type
    )
    trade.ticker = updated_trade_data.get("ticker", trade.ticker)

    # Update owner and source IDs
    owner_changed = trade.trade_owner_id != new_owner_id
    source_changed = trade.trade_source_id != new_source_id
    ticker_changed = trade.ticker != updated_trade_data.get("ticker", trade.ticker)

    trade.trade_owner_id = new_owner_id
    trade.trade_source_id = new_source_id
    # Update relationships too, for consistency within the session
    trade.owner = owner
    trade.source = source

    db.session.add(trade)
    db.session.flush()

    # If key holding identifiers changed (owner, source, ticker), recalculate the OLD holding
    # and then recalculate/create the NEW holding for the updated trade.
    if owner_changed or source_changed or ticker_changed:
        log.debug(
            f"Owner/Source/Ticker changed for Trade {trade.id}. Recalculating old holding {old_holding_id}."
        )
        # Recalculate the original holding (if it exists)
        response_old_holding = get_holding_by_id(old_holding_id)
        if response_old_holding.success:
            recalc_unrealized_holding(response_old_holding.data)
        else:
            log.warning(f"Old holding {old_holding_id} not found for recalculation.")

        # Process the updated trade as if it were new to find/create its correct holding
        # This will assign the correct new holding_id to the trade object
        log.debug(
            f"Processing updated Trade {trade.id} to find/create its new holding."
        )
        process_new_trade(trade)
        log.debug(
            f"Updated Trade {trade.id} assigned to new/existing Holding {trade.holding_id}."
        )

    else:
        # If only quantity/price/date changed, just recalculate the current holding
        log.debug(
            f"Recalculating current holding {trade.holding_id} for updated Trade {trade.id}."
        )
        response_current_holding = get_holding_by_id(trade.holding_id)
        if response_current_holding.success:
            recalc_unrealized_holding(response_current_holding.data)
        else:
            log.error(f"Holding {trade.holding_id} not found during update.")
            # Optionally, treat as new if holding is missing?
            # process_new_trade(trade)

    # Commit happens after all recalculations within the calling route
    # db.session.commit() # Moved commit to route handler
    log.debug(f"Updated trade {trade.id}. Associated holding ID: {trade.holding_id}")
    return trade  # Return the updated trade object


def delete_trade(trade_to_delete):
    """
    Delete a trade and update its associated unrealized holding.

    After deletion, the function recalculates the holding based on the remaining trades.
    If no trades remain, the holding is removed.
    """
    response_trade = get_trade_by_id(trade_to_delete.id)
    if not response_trade.success:
        log.error(f"Trade {trade_to_delete.id} not found for deletion.")
        raise TradeNotFoundException(response_trade.error_message)
    trade = response_trade.data

    holding_id = trade.holding_id
    trade.soft_delete()
    db.session.flush()

    holding = None
    response_holding = get_holding_by_id(holding_id)
    if response_holding.success:
        holding = response_holding.data
        recalc_unrealized_holding(holding)
    else:
        log.error(f"Holding {holding_id} not found during deletion.")

    db.session.commit()
    log.debug(f"Deleted trade {trade_to_delete.id} and updated holding {holding_id}.")
    return holding
