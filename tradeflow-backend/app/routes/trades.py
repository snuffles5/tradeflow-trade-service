import json
import os
from collections import defaultdict

from app.database import db
from app.models import Trade
from app.models import TradeOwner
from app.models import TradeSource
from app.schemas import TradeOwnerSchema
from app.schemas import TradeSchema
from app.schemas import TradeSourceSchema
from app.schemas import UnrealizedHoldingSchema
from exceptions import HoldingRetrievalError
from exceptions import TradeNotFoundException
from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from services.db_queries import get_active_trades
from services.db_queries import get_all_holdings
from services.db_queries import get_trade_by_id
from services.db_queries import get_trades_by_holding_id
from services.providers.factory import ProviderFactory
from services.trade_holdings import get_holding_period
from services.trade_holdings import process_new_trade
from sqlalchemy.orm import joinedload
from utils.consts import TRADES_JSON_FILE_PATH
from utils.logger import log
from utils.text_utils import dict_keys_to_camel
from utils.text_utils import dict_keys_to_snake

trades_bp = Blueprint("trades_bp", __name__)

# Instantiate the price provider (with 5 minutes caching)
provider_factory = ProviderFactory(cache_duration=300)


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
    """
    Fetches all unrealized holdings, includes nested owner/source.
    (Reverted to previous simplified version for debugging)
    """
    with current_app.app_context():
        response = get_all_holdings()
        if not response.success:
            current_app.logger.error(
                f"Holding retrieval failed: {response.error_message}"
            )
            raise HoldingRetrievalError(response.error_message)
        holdings = response.data

        # Ensure holdings is a list (though get_all_holdings should return one)
        if not isinstance(holdings, list):
            log.warning(
                f"get_all_holdings did not return a list. Type: {type(holdings)}. Wrapping in list."
            )
            holdings = [holdings] if holdings else []

        results = []
        holding_schema = UnrealizedHoldingSchema()

        for h in holdings:
            try:
                holding_dict_snake = holding_schema.dump(h)
                response_trades = get_trades_by_holding_id(h.id)
                holding_trades = response_trades.data if response_trades.success else []
                holding_dict_snake["trade_count"] = len(holding_trades)
                try:
                    holding_dict_snake["holding_period"] = get_holding_period(h)
                except Exception as period_err:
                    current_app.logger.error(
                        f"Error calculating holding period for {h.id}: {period_err}",
                        exc_info=True,
                    )
                    holding_dict_snake["holding_period"] = None

                # Temporarily remove profit calculation again
                holding_dict_snake.pop("profit", None)
                holding_dict_snake.pop("profit_percentage", None)

                results.append(dict_keys_to_camel(holding_dict_snake))
            except Exception as loop_err:
                current_app.logger.error(
                    f"Error processing holding ID {h.id}: {str(loop_err)}",
                    exc_info=True,
                )
                continue

        # Reverted: Removed logging before return
        return jsonify(results), 200


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
    """
    Fetches the latest market price for a given ticker (from your price provider).
    """
    try:
        stock = provider_factory.get_stock(ticker)
        return (
            jsonify(
                dict_keys_to_camel(
                    {
                        "ticker": ticker,
                        "last_price": stock.price,
                        "change_today": stock.change_today,
                        "change_today_percentage": stock.change_today_percentage,
                    }
                )
            ),
            200,
        )
    except Exception as e:
        current_app.logger.error(f"Error fetching last price for {ticker}: {str(e)}")
        return jsonify({"error": "failed to get last price"}), 500


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
