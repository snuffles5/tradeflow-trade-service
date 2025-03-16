import json
import os

from app.database import db
from app.models import Trade
from app.models import UnrealizedHolding
from app.schemas import TradeSchema
from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from services.providers.factory import ProviderFactory
from services.trade_holdings import get_holding_period
from services.trade_holdings import process_new_trade
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
    """
    trade_record = {
        "ticker": new_trade.ticker,
        "created_at": new_trade.created_at.strftime("%m/%d/%Y"),
        "updated_at": new_trade.updated_at.strftime("%m/%d/%Y"),
        "trade_type": new_trade.trade_type,
        "source": new_trade.source,
        "transaction_type": new_trade.transaction_type,
        "quantity": new_trade.quantity,
        "price_per_unit": f"{new_trade.price_per_unit:.2f}",
        "trade_date": new_trade.trade_date.strftime("%m/%d/%Y"),
        "holding_id": new_trade.holding_id,
    }

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
        # Load the data; post_load returns a Trade instance.
        loaded_trade = trade_schema.load(converted_data)
        log.info(f"Loaded trade: {loaded_trade}")
    except Exception as e:
        current_app.logger.error(f"Schema validation failed: {str(e)}")
        return jsonify({"error": str(e)}), 400

    # Use property access since loaded_trade is already a Trade instance.
    new_trade = Trade(
        trade_type=loaded_trade.trade_type,
        source=loaded_trade.source,
        transaction_type=loaded_trade.transaction_type,
        ticker=loaded_trade.ticker,
        quantity=loaded_trade.quantity,
        price_per_unit=loaded_trade.price_per_unit,
        trade_date=loaded_trade.trade_date,
        holding_id=None,
    )

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
    Returns a list of all trades in the database.
    """
    with current_app.app_context():
        trades = Trade.query.all()
        results = []
        for t in trades:
            results.append(
                {
                    "id": t.id,
                    "trade_type": t.trade_type,
                    "source": t.source,
                    "transaction_type": t.transaction_type,
                    "ticker": t.ticker,
                    "quantity": t.quantity,
                    "price_per_unit": t.price_per_unit,
                    "trade_date": t.trade_date.isoformat(),
                    "created_at": t.created_at.isoformat(),
                    "updated_at": t.updated_at.isoformat(),
                    "holding_id": t.holding_id,
                }
            )
        current_app.logger.info("Fetched all trades.")
        return jsonify(dict_keys_to_camel(results)), 200


@trades_bp.route("/holdings", methods=["GET"])
def list_holdings():
    """
    Fetches all unrealized holdings (open or closed).
    You can filter out closed holdings (where close_date is not NULL)
    if you only want open positions.
    """
    with current_app.app_context():
        holdings = UnrealizedHolding.query.all()
        results = []
        for h in holdings:
            holding_trades = (
                Trade.query.filter(Trade.holding_id == h.id)
                .order_by(Trade.trade_date.asc())
                .all()
            )
            holding_trade_dicts = [t.to_dict() for t in holding_trades]

            profit = sum(
                t.quantity
                * (
                    t.price_per_unit
                    if str(t.transaction_type).lower() == "sell"
                    else -t.price_per_unit
                )
                for t in holding_trades
            )
            if h.net_quantity == 0:
                total_buy_amount = sum(
                    t.quantity * t.price_per_unit
                    for t in holding_trades
                    if t.transaction_type.lower() == "buy"
                )
                total_sell_amount = sum(
                    t.quantity * t.price_per_unit
                    for t in holding_trades
                    if t.transaction_type.lower() == "sell"
                )

                realized_profit = total_sell_amount - total_buy_amount
                profit_percentage = (
                    (realized_profit / total_buy_amount * 100)
                    if total_buy_amount
                    else 0
                )
            else:
                profit_percentage = 0

            results.append(
                {
                    "id": h.id,
                    "ticker": h.ticker,
                    "source": h.source,
                    "trade_type": h.trade_type,
                    "net_quantity": h.net_quantity,
                    "average_cost": h.average_cost,
                    "net_cost": h.net_cost,
                    "latest_trade_price": h.latest_trade_price,
                    "open_date": h.open_date.isoformat() if h.open_date else None,
                    "close_date": h.close_date.isoformat() if h.close_date else None,
                    "holding_period": get_holding_period(h),
                    "trade_count": len(holding_trade_dicts),
                    "trades": holding_trade_dicts,
                    "deleted_at": h.deleted_at.isoformat() if h.deleted_at else None,
                    "profit": round(profit, 2),
                    "profit_percentage": profit_percentage,
                }
            )
        current_app.logger.info("Fetched all holdings.")
        return jsonify(dict_keys_to_camel(results)), 200


@trades_bp.route("/holdings-summary", methods=["GET"])
def holdings_summary():
    """
    Returns aggregated metrics from the holdings table, e.g. total net cost, total profit, etc.
    Adjust logic as needed for your business rules.
    """
    with current_app.app_context():
        holdings = UnrealizedHolding.query.all()
        total_net_cost = 0
        total_profit = 0
        net_cash_personal_interactive = 0
        net_cash_personal_one_zero = 0
        net_cash_joint_interactive = 0

        for h in holdings:
            net_quantity = h.net_quantity
            cost_basis = h.net_cost

            if h.trade_type == "personal" and h.source.lower() == "interactive":
                net_cash_personal_interactive += cost_basis
            if h.trade_type == "personal one zero":
                net_cash_personal_one_zero += cost_basis
            if h.trade_type == "joint" and h.source.lower() == "interactive":
                net_cash_joint_interactive += cost_basis

            # Example profit calculation for an open position
            # (closed holdings might have close_date set, or net_quantity=0)
            if net_quantity != 0:
                profit = (h.latest_trade_price - h.average_cost) * net_quantity
            else:
                # Possibly track a final realized profit for closed holdings if desired
                # or treat it as (h.latest_trade_price - h.average_cost) * net_quantity
                profit = (h.latest_trade_price - h.average_cost) * net_quantity
            total_net_cost += cost_basis
            total_profit += profit

        summary = {
            "overall": {
                "total_net_cost": round(total_net_cost, 2),
            },
            "net_cash": {
                "net_cash_personal_interactive": round(
                    net_cash_personal_interactive, 2
                ),
                "net_cash_personal_one_zero": round(net_cash_personal_one_zero, 2),
                "net_cash_joint_interactive": round(net_cash_joint_interactive, 2),
            },
        }

        return jsonify(dict_keys_to_camel(summary)), 200


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
