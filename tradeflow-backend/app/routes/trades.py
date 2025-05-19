import json
import os
from collections import defaultdict
from datetime import datetime
from datetime import timedelta
from datetime import timezone

from app import db
from app.models import LastPriceInfo
from app.models import Trade
from app.models import TradeOwner
from app.models import TradeSource
from app.models import UnrealizedHolding
from app.schemas import TradeOwnerSchema
from app.schemas import TradeSchema
from app.schemas import TradeSourceSchema
from exceptions import HoldingRetrievalError
from exceptions import TradeNotFoundException
from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from services.db_queries import get_active_trades
from services.db_queries import get_all_holdings
from services.db_queries import get_trade_by_id
from services.providers.factory import CACHE_DURATION
from services.providers.factory import ProviderFactory
from services.trade_holdings import get_holding_period
from services.trade_holdings import process_new_trade
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import selectinload
from utils.consts import TRADES_JSON_FILE_PATH
from utils.logger import log
from utils.text_utils import dict_keys_to_camel
from utils.text_utils import dict_keys_to_snake

trades_bp = Blueprint("trades_bp", __name__)

# Instantiate the price provider (with 5 minutes caching)
provider_factory = ProviderFactory(cache_duration=CACHE_DURATION)

# Define cache threshold for the route-level DB cache
ROUTE_CACHE_THRESHOLD = timedelta(
    minutes=CACHE_DURATION / 60
)  # Convert seconds to minutes


def save_to_file(new_trade):
    """
    Persists new_trade to the JSON file for reference.
    Adjust or remove if you no longer want to store JSON copies.
    Uses owner and source names from relationships.
    """
    # Access names via relationships, handle potential None if relationships aren't loaded/set
    owner_name = new_trade.owner.name if new_trade.owner else None
    source_name = new_trade.source.name if new_trade.source else None

    trade_record = {
        "ticker": new_trade.ticker,
        "created_at": new_trade.created_at.strftime("%m/%d/%Y"),
        "updated_at": new_trade.updated_at.strftime("%m/%d/%Y"),
        "trade_owner": owner_name,  # Changed from trade_type
        "trade_source": source_name,  # Changed from source
        "transaction_type": new_trade.transaction_type,
        "quantity": new_trade.quantity,
        "price_per_unit": f"{new_trade.price_per_unit:.2f}",
        "trade_date": new_trade.trade_date.strftime("%m/%d/%Y"),
        "holding_id": new_trade.holding_id,
    }

    # Check if owner_name or source_name is None, which indicates an issue
    if owner_name is None or source_name is None:
        log.warning(
            f"Could not determine owner/source name for trade "
            f"{new_trade.id} when saving to JSON. Owner: {owner_name}, Source: {source_name}"
        )
        # Decide whether to skip saving or save with None values
        # return # Option: Skip saving if names are missing

    if os.path.exists(TRADES_JSON_FILE_PATH):
        with open(TRADES_JSON_FILE_PATH) as file:
            try:
                trades_list = json.load(file)
            except json.JSONDecodeError:
                trades_list = []
    else:
        trades_list = []

    # Append the new record and save
    trades_list.append(trade_record)
    try:
        with open(TRADES_JSON_FILE_PATH, "w") as file:
            json.dump(trades_list, file, indent=2)
            log.debug(f"Trade saved to file: {TRADES_JSON_FILE_PATH}")
    except Exception as e:
        current_app.logger.error(f"Error saving trade to file: {str(e)}")


@trades_bp.route("/trades", methods=["POST"])
def create_trade():
    """
    Creates a new trade, processes it (updating or creating a holding),
    and persists it to the database and optional JSON file.
    """
    log.info("Creating a new trade. Request data:\nBody: %s", request.json)
    trade_schema = TradeSchema()
    try:
        # Convert incoming JSON keys from camelCase to snake_case.
        converted_data = dict_keys_to_snake(request.json)
        converted_data["ticker"] = converted_data["ticker"].upper()

        # Validate owner and source IDs exist before loading
        owner_id = converted_data.get("trade_owner_id")
        source_id = converted_data.get("trade_source_id")

        owner = db.session.get(TradeOwner, owner_id)
        source = db.session.get(TradeSource, source_id)

        if not owner:
            return jsonify({"error": f"TradeOwner with id {owner_id} not found"}), 400
        if not source:
            return jsonify({"error": f"TradeSource with id {source_id} not found"}), 400

        # Validate that the selected owner is valid for the selected source
        if owner not in source.owners:
            return (
                jsonify(
                    {
                        "error": f"TradeOwner '{owner.name}' is not valid for TradeSource '{source.name}'"
                    }
                ),
                400,
            )

        # Load the data; post_load returns a Trade instance without relationships set
        loaded_trade_data = trade_schema.load(converted_data)
        log.info(f"Loaded trade data: {loaded_trade_data}")

    except Exception as e:
        current_app.logger.error(f"Validation or loading failed: {str(e)}")
        return jsonify({"error": str(e)}), 400

    # Create Trade instance using validated data
    new_trade = Trade(
        # Assign FK IDs directly from validated input
        trade_owner_id=loaded_trade_data.trade_owner_id,
        trade_source_id=loaded_trade_data.trade_source_id,
        transaction_type=loaded_trade_data.transaction_type,
        ticker=loaded_trade_data.ticker,
        quantity=loaded_trade_data.quantity,
        price_per_unit=loaded_trade_data.price_per_unit,
        trade_date=loaded_trade_data.trade_date,
        holding_id=None,
    )

    # Assign relationships explicitly after checking IDs
    new_trade.owner = owner
    new_trade.source = source

    db.session.add(new_trade)
    db.session.flush()  # Ensure new_trade is attached and gets an ID

    # Process the trade to update/create the corresponding holding and update new_trade.holding_id.
    process_new_trade(new_trade)

    save_to_file(new_trade)

    db.session.commit()

    current_app.logger.info(f"Trade created with ID: {new_trade.id}")
    return (
        jsonify(
            dict_keys_to_camel({"message": "trade created", "trade_id": new_trade.id})
        ),
        201,
    )


@trades_bp.route("/trades", methods=["GET"])
def list_trades():
    """
    Returns a list of all trades in the database, including nested owner/source info.
    """
    with current_app.app_context():
        response = get_active_trades()
        if not response.success:
            current_app.logger.error(response.error_message)
            return jsonify({"error": response.error_message}), response.code
        trades = response.data

        # Use schema to dump data, including nested owner/source
        schema = TradeSchema(many=True)
        results = schema.dump(trades)

        current_app.logger.info("Fetched all trades.")
        return (
            jsonify(dict_keys_to_camel(results)),
            200,
        )  # Keep camelCase conversion for frontend


@trades_bp.route("/holdings", methods=["GET"])
def list_holdings():
    current_app.logger.info("Received request for /holdings")
    try:
        holdings = (
            UnrealizedHolding.query
            # Eager load related data to avoid N+1 queries
            .options(
                selectinload(
                    UnrealizedHolding.trades
                ),  # Load all trades for holding period calc
                joinedload(UnrealizedHolding.source),  # Load source info
                joinedload(UnrealizedHolding.owner),  # Load owner info
            )
            .order_by(UnrealizedHolding.ticker)
            .all()
        )

        results = []
        for holding in holdings:
            # Basic data from the holding record
            holding_data = {
                "id": holding.id,
                "ticker": holding.ticker,
                "netQuantity": holding.net_quantity,
                "netCost": holding.net_cost,
                "averageCost": holding.average_cost,
                "holdingPeriod": get_holding_period(holding),
                "tradeCount": len(holding.trades),  # Simple trade count
                "source": {"id": holding.source.id, "name": holding.source.name}
                if holding.source
                else None,
                "owner": {"id": holding.owner.id, "name": holding.owner.name}
                if holding.owner
                else None,
                "status": "closed"
                if holding.net_quantity == 0
                else "open",  # Determine status
                # Include the realized P/L fields (might be None if not calculated yet)
                "realizedPnl": holding.realized_pnl,
                "realizedPnlPercentage": holding.realized_pnl_percentage,
                # Add latest trade price for reference (useful for closed positions)
                "latestTradePrice": holding.latest_trade_price,
                # Add new total fields needed for frontend calculation
                "totalBuyQuantity": holding.total_buy_quantity,
                "totalBuyCost": holding.total_buy_cost,
                "totalSellQuantity": holding.total_sell_quantity,
                "totalSellValue": holding.total_sell_value,
            }
            results.append(
                dict_keys_to_camel(holding_data)
            )  # Convert keys for frontend

        current_app.logger.info(f"Returning {len(results)} holdings from /holdings")
        return jsonify(results)

    except Exception as e:
        current_app.logger.error(f"Error in /holdings: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch holdings"}), 500


@trades_bp.route("/holdings-summary", methods=["GET"])
def holdings_summary():
    """
    Returns aggregated metrics, including a dynamic breakdown of net cost
    per owner/source combination.
    """
    with current_app.app_context():
        # Eager load owner and source to avoid N+1 queries in the loop
        response = (
            get_all_holdings()
        )  # This should already use joinedload if updated previously
        if not response.success:
            raise HoldingRetrievalError(response.error_message)
        holdings = response.data

        total_net_cost_overall = 0
        net_cash_breakdown = defaultdict(float)  # Use defaultdict for easy summing

        for h in holdings:
            # Ensure owner and source are loaded (should be due to joinedload in get_all_holdings)
            if h.owner and h.source:
                key = f"{h.owner.name} - {h.source.name}"  # Create a unique key for the combo
                cost_basis = h.net_cost or 0  # Handle potential None
                net_cash_breakdown[key] += cost_basis
                total_net_cost_overall += cost_basis
            else:
                log.warning(
                    f"Holding {h.id} is missing owner or source relationship during summary calculation."
                )

        # Convert the defaultdict to a list of objects for the JSON response
        # and filter out zero-value entries
        dynamic_breakdown_list = [
            {"combination": key, "netCost": round(value, 2)}
            for key, value in net_cash_breakdown.items()
            if round(value, 2) != 0  # Only include non-zero balances
        ]
        # Sort the list alphabetically by combination name
        dynamic_breakdown_list.sort(key=lambda item: item["combination"])

        summary = {
            "overall": {
                "totalNetCost": round(total_net_cost_overall, 2),
            },
            "netCashBreakdown": dynamic_breakdown_list  # New dynamic list
            # Removed old hardcoded net_cash section
            # "net_cash": { ... }
        }

        # Return directly without dict_keys_to_camel, as keys are already camelCase
        return jsonify(summary), 200


@trades_bp.route("/stock-info/<ticker>", methods=["GET"])
def get_stock_info(ticker):
    ticker = ticker.upper()  # Standardize ticker
    log.debug(f"Received request for /stock-info/{ticker}")

    # 1. Check DB Cache (LastPriceInfo table)
    cached_info = db.session.query(LastPriceInfo).filter_by(ticker=ticker).first()
    now = datetime.now(timezone.utc)  # Use timezone-aware datetime

    if cached_info and cached_info.last_updated:
        # Ensure last_updated is timezone-aware for comparison
        # It *should* be timezone-aware now if we always write UTC
        last_updated_aware = cached_info.last_updated
        if last_updated_aware.tzinfo is None:
            # If somehow still naive, assume UTC (fallback)
            log.warning(f"last_updated for {ticker} was naive in DB, assuming UTC.")
            last_updated_aware = last_updated_aware.replace(tzinfo=timezone.utc)

        # Remove noisy debug logs for timestamps
        # log.debug(f"Last updated for {ticker}: {last_updated_aware}")
        # log.debug(f"now: {now}")
        if (now - last_updated_aware) < ROUTE_CACHE_THRESHOLD:
            log.debug(f"Cache hit for {ticker} in LastPriceInfo table.")
            # Return cached data, converting keys to camelCase
            cached_data = {
                "ticker": cached_info.ticker,
                "lastPrice": cached_info.last_price,
                "changeToday": cached_info.change_today,
                "changeTodayPercentage": cached_info.change_today_percentage,
                "marketIdentifier": cached_info.market_identifier,
                "providerSource": cached_info.provider_source,
                "lastUpdated": cached_info.last_updated.isoformat(),  # Send as ISO string
            }
            return jsonify(dict_keys_to_camel(cached_data))
        else:
            log.debug(
                f"Cache stale for {ticker}. Last updated: {cached_info.last_updated}"
            )
    else:
        log.debug(f"Cache miss for {ticker} in LastPriceInfo table.")

    # 2. Cache Miss or Stale: Fetch from provider
    market_hint = cached_info.market_identifier if cached_info else None
    provider_hint = cached_info.provider_source if cached_info else None
    log.debug(
        f"Fetching fresh data for {ticker} with market hint: {market_hint} from provider hint: {provider_hint}"
    )

    try:
        # Pass both market and provider hints to the factory
        stock = provider_factory.get_stock(
            ticker, market_identifier=market_hint, provider_source_hint=provider_hint
        )

        if stock:
            log.debug(
                f"Successfully fetched fresh data for {ticker} via provider: {stock.provider_name}"
            )

            # 3. Update DB Cache (Use merge for atomic insert/update)
            # Merge the data: Inserts if ticker doesn't exist, updates if it does.
            # Assumes 'ticker' is unique and acts like the key for finding existing rows.
            # We query first to get the primary key (id) if it exists, or let merge create it.
            existing_entry = (
                db.session.query(LastPriceInfo).filter_by(ticker=ticker).first()
            )
            if existing_entry:
                # Update existing entry's fields before merging to preserve the ID
                existing_entry.last_price = stock.price
                existing_entry.change_today = stock.change_today
                existing_entry.change_today_percentage = stock.change_today_percentage
                existing_entry.market_identifier = stock.market_identifier
                existing_entry.provider_source = stock.provider_name
                # Explicitly set last_updated to current UTC time
                existing_entry.last_updated = now
                # Merge will now ensure this state is saved for the existing ID
                db.session.merge(existing_entry)
                log.debug(f"Merging updated cache entry for {ticker}")
            else:
                # Create new cache entry object with explicit UTC timestamp
                cache_entry_data = LastPriceInfo(
                    ticker=ticker,
                    last_price=stock.price,
                    change_today=stock.change_today,
                    change_today_percentage=stock.change_today_percentage,
                    market_identifier=stock.market_identifier,
                    provider_source=stock.provider_name,
                    last_updated=now,  # Set timestamp explicitly
                )
                # Ticker doesn't exist, merge will insert the new object
                db.session.merge(cache_entry_data)
                log.debug(f"Merging new cache entry for {ticker}")

            db.session.commit()
            log.debug(f"Cache updated/merged for {ticker}")

            # Return the newly fetched data, create the dict AFTER commit
            # so the potentially DB-generated last_updated is available if needed.
            # Re-fetch or assume now() is close enough for immediate response.
            final_data_to_return = {
                "ticker": ticker,
                "lastPrice": stock.price,
                "changeToday": stock.change_today,
                "changeTodayPercentage": stock.change_today_percentage,
                "marketIdentifier": stock.market_identifier,
                "providerSource": stock.provider_name,
                # Use the current time for the response, as the DB value
                # might not be immediately reflected without a re-query.
                "lastUpdated": now.isoformat(),
            }
            return jsonify(dict_keys_to_camel(final_data_to_return))
        else:
            # Provider returned None (e.g., ticker not found by provider)
            log.warning(f"No stock info found for {ticker} via provider")
            # Should we cache this failure? Maybe not, allow retries.
            return jsonify({"error": "Stock data not found by provider"}), 404

    except Exception as e:
        db.session.rollback()  # Rollback cache update attempt on error
        log.error(
            f"Error fetching stock info for {ticker} via provider: {e}", exc_info=True
        )
        # Return appropriate error response
        if "not found" in str(e).lower():  # Basic error check
            return (
                jsonify({"error": f"Failed to get stock info for {ticker}: Not Found"}),
                404,
            )
        return jsonify({"error": f"Failed to fetch stock data for {ticker}"}), 500


@trades_bp.route("/trades/<int:trade_id>", methods=["PUT"])
def update_trade(trade_id):
    """
    Update an existing trade.
    Expects JSON payload with fields including trade_owner_id, trade_source_id.
    """
    from services.trade_holdings import update_existing_trade
    from utils.text_utils import dict_keys_to_snake, dict_keys_to_camel

    data = request.json
    try:
        # Add trade_id to the data dictionary for the service function
        data["id"] = trade_id
        data_snake = dict_keys_to_snake(data)
        # The service function now handles validation and update
        updated_trade = update_existing_trade(data_snake)
        db.session.commit()  # Commit after successful service call
        current_app.logger.info(f"Trade updated with ID: {updated_trade.id}")
        # Use schema to dump the updated trade, ensuring consistent output
        schema_output = TradeSchema().dump(updated_trade)
        return (
            jsonify(
                dict_keys_to_camel({"message": "Trade updated", "trade": schema_output})
            ),
            200,
        )
    except (ValueError, TradeNotFoundException) as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating trade {trade_id}: {str(e)}")
        return jsonify({"error": str(e)}), 400  # Use 400 for validation errors
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(
            f"Unexpected error updating trade {trade_id}: {str(e)}"
        )
        return jsonify({"error": "An unexpected error occurred"}), 500


@trades_bp.route("/trades/<int:trade_id>", methods=["DELETE"])
def delete_trade_route(trade_id):
    """
    Delete an existing trade and update its associated holding.
    """
    from services.trade_holdings import delete_trade
    from utils.text_utils import dict_keys_to_camel

    response_trade = get_trade_by_id(trade_id)
    if not response_trade.success:
        return jsonify({"error": response_trade.error_message}), response_trade.code
    trade = response_trade.data
    if not trade:
        return jsonify({"error": "Trade not found"}), 404

    try:
        delete_trade(trade)
        db.session.commit()
        current_app.logger.info(f"Trade deleted with ID: {trade_id}")
        return (
            jsonify(
                dict_keys_to_camel({"message": "Trade deleted", "trade_id": trade_id})
            ),
            200,
        )
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting trade: {str(e)}")
        return jsonify({"error": str(e)}), 400


# --- New Endpoints for Owners and Sources ---


@trades_bp.route("/trade-owners", methods=["GET"])
def list_trade_owners():
    """Returns a list of all trade owners."""
    try:
        owners = TradeOwner.query.order_by(TradeOwner.name).all()
        schema = TradeOwnerSchema(many=True)
        return jsonify(schema.dump(owners)), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching trade owners: {str(e)}")
        return jsonify({"error": "Failed to fetch trade owners"}), 500


@trades_bp.route("/trade-sources", methods=["GET"])
def list_trade_sources():
    """
    Returns a list of all trade sources, including the owners
    associated with each source.
    """
    try:
        # Use joinedload to efficiently fetch associated owners
        sources = (
            TradeSource.query.options(joinedload(TradeSource.owners))
            .order_by(TradeSource.name)
            .all()
        )
        # Manually sort owners within each source for consistent frontend display
        for source in sources:
            source.owners.sort(key=lambda owner: owner.name)
        schema = TradeSourceSchema(many=True)  # Schema includes nested owners
        return jsonify(schema.dump(sources)), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching trade sources: {str(e)}")
        return jsonify({"error": "Failed to fetch trade sources"}), 500
