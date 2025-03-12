import json
import os

from flask import Blueprint, request, jsonify, current_app

from services.providers.factory import ProviderFactory
from services.trade_holdings import process_new_trade
from app.database import db
from app.models import Trade, UnrealizedHolding
from app.schemas import TradeSchema
from utils.consts import TRADES_JSON_FILE_PATH
from utils.text_utils import dict_keys_to_camel

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
        with open(TRADES_JSON_FILE_PATH, "r") as file:
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
    except Exception as e:
        current_app.logger.error(f"Error saving trade to file: {str(e)}")


@trades_bp.route("/trades", methods=["POST"])
def create_trade():
    """
    Creates a new trade, processes it (updating or creating a holding),
    and persists it to the database and optional JSON file.
    """
    trade_schema = TradeSchema()
    try:
        data = trade_schema.load(request.json)
    except Exception as e:
        current_app.logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400

    new_trade = Trade(
        trade_type=data["trade_type"],
        source=data["source"],
        transaction_type=data["transaction_type"],
        ticker=data["ticker"],
        quantity=data["quantity"],
        price_per_unit=data["price_per_unit"],
        trade_date=data["trade_date"],
        holding_id=data.get("holding_id")
    )

    db.session.add(new_trade)
    db.session.flush()  # Ensure new_trade is attached and gets an ID

    # Update or create the corresponding unrealized holding, linking back to new_trade.
    process_new_trade(new_trade)

    save_to_file(new_trade)

    db.session.commit()

    current_app.logger.info(f"Trade created with ID: {new_trade.id}")
    return jsonify(dict_keys_to_camel({"message": "trade created", "trade_id": new_trade.id})), 201


@trades_bp.route("/trades", methods=["GET"])
def list_trades():
    """
    Returns a list of all trades in the database.
    """
    with current_app.app_context():
        trades = Trade.query.all()
        results = []
        for t in trades:
            results.append({
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
            })
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
            # Calculate optional derived metrics such as profit, holding_period, etc. if needed
            # For instance:
            if h.net_quantity != 0:
                # For open holdings
                profit = (h.latest_trade_price - h.average_cost) * h.net_quantity
            else:
                # For closed holdings, or set profit to 0 if you prefer
                profit = (h.latest_trade_price - h.average_cost) * h.net_quantity

            results.append({
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
                "deleted_at": h.deleted_at.isoformat() if h.deleted_at else None,
                "profit": round(profit, 2),
            })
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

        for h in holdings:
            net_quantity = h.net_quantity
            cost_basis = h.net_cost
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
            "total_net_cost": round(total_net_cost, 2),
            "total_profit": round(total_profit, 2),
        }
        return jsonify(dict_keys_to_camel(summary)), 200


@trades_bp.route("/stock-info/<ticker>", methods=["GET"])
def get_stock_info(ticker):
    """
    Fetches the latest market price for a given ticker (from your price provider).
    """
    try:
        stock = provider_factory.get_stock(ticker)
        return jsonify(dict_keys_to_camel({
            "ticker": ticker,
            "last_price": stock.price,
            "change_today": stock.change_today,
            "change_today_percentage": stock.change_today_percentage,
        })), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching last price for {ticker}: {str(e)}")
        return jsonify({"error": "failed to get last price"}), 500
