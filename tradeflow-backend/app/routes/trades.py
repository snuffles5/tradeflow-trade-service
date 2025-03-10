import json
import os

from flask import Blueprint, request, jsonify, current_app

from services.providers.factory import ProviderFactory
from services.trade_holdings import (
    merge_trades,
    process_new_trade,
    calculate_closed_position,
    calculate_open_position,
    aggregate_overall_metrics,
)
from app.database import db
from app.models import Trade
from app.schemas import TradeSchema
from utils.consts import TRADES_JSON_FILE_PATH
from utils.text_utils import dict_keys_to_camel

trades_bp = Blueprint("trades_bp", __name__)

# Instantiate the price provider (with 5 minutes caching)
provider_factory = ProviderFactory(cache_duration=300)


def save_to_file(new_trade):
    # File path for storing trades

    # Append the new trade to JSON file
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
        "holding_id": new_trade.holding_id,  # new field added
    }

    # Load existing data if the file exists
    if os.path.exists(TRADES_JSON_FILE_PATH):
        with open(TRADES_JSON_FILE_PATH, "r") as file:
            try:
                trades_list = json.load(file)
            except json.JSONDecodeError:
                trades_list = []  # Reset if JSON is corrupted
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
    trade_schema = TradeSchema()
    try:
        data = trade_schema.load(request.json)
    except Exception as e:
        current_app.logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400

    # Construct and save the Trade object using updated field names.
    new_trade = Trade(
        trade_type=data["trade_type"],
        source=data["source"],
        transaction_type=data["transaction_type"],
        ticker=data["ticker"],
        quantity=data["quantity"],
        price_per_unit=data["price_per_unit"],
        trade_date=data["trade_date"],
        holding_id=data.get("holding_id")  # may be None if not provided
    )

    db.session.add(new_trade)
    db.session.flush()  # flush so that new_trade is attached and gets an ID

    # Process the trade to update/create the corresponding holding and update new_trade.holding_id.
    process_new_trade(new_trade)

    save_to_file(new_trade)

    # Commit all changes at once.
    db.session.commit()

    current_app.logger.info(f"Trade created with ID: {new_trade.id}")
    return jsonify(dict_keys_to_camel({"message": "trade created", "trade_id": new_trade.id})), 201


@trades_bp.route("/trades", methods=["GET"])
def list_trades():
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
        current_app.logger.info("Fetched all trades")
        return jsonify(dict_keys_to_camel(results)), 200


@trades_bp.route("/aggregated-trades", methods=["GET"])
def aggregated_trades():
    # Query all trades from the database.
    with current_app.app_context():
        trades = Trade.query.all()
        trades_list = []
        for trade in trades:
            # Format trade_date as MM/DD/YYYY
            trade_date_str = trade.trade_date.strftime("%m/%d/%Y") if trade.trade_date else None

            trade_dict = {
                "ticker": trade.ticker,
                "source": trade.source,
                "trade_type": trade.trade_type,
                "quantity": trade.quantity,
                "price_per_unit": trade.price_per_unit,
                "trade_date": trade_date_str,
                "transaction_type": trade.transaction_type,
            }
            trades_list.append(trade_dict)

        # Merge similar trades (grouping by ticker, source, and trade_type)
        summary_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'trade_type'])
        return jsonify(dict_keys_to_camel(summary_data)), 200


@trades_bp.route("/trade-summary", methods=["GET"])
def trade_summary():
    # Query all trades from the database.
    with current_app.app_context():
        trades = Trade.query.all()
        trades_list = []
        for trade in trades:
            trade_date_str = trade.trade_date.strftime("%m/%d/%Y") if trade.trade_date else None
            trade_dict = {
                "ticker": trade.ticker,
                "source": trade.source,
                "trade_type": trade.trade_type,
                "quantity": trade.quantity,
                "price_per_unit": trade.price_per_unit,
                "trade_date": trade_date_str,
                "transaction_type": trade.transaction_type,
                "holding_id": trade.holding_id,
                "current_price": provider_factory.get_price(trade.ticker) if trade.quantity != 0 else None
            }
            trades_list.append(trade_dict)

        # Merge trades by ticker, source, and trade_type.
        merged_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'trade_type'])

        # Aggregate overall metrics using the imported helper.
        overall_net_cash, overall_profit, overall_profit_percentage = aggregate_overall_metrics(merged_data)

        # Compute per-source and per-type aggregations.
        by_source = {}
        by_type = {}
        for group in merged_data:
            quantity = group.get("total_quantity", 0)
            if quantity == 0:
                net_cash, profit, _ = calculate_closed_position(group)
            else:
                _, profit, _ = calculate_open_position(group)
                current_price = group.get("current_price") or group.get("last_price") or 0
                net_cash = current_price * quantity

            group_buy_amount = sum(
                t['quantity'] * t['price_per_unit']
                for t in group.get('trades', [])
                if t.get('transaction_type', '').lower() == 'buy'
            )

            src = group.get("source", "Unknown")
            if src not in by_source:
                by_source[src] = {"total_net_cash": 0, "total_profit": 0, "buy_amount": 0, "count": 0}
            by_source[src]["total_net_cash"] += net_cash
            by_source[src]["total_profit"] += profit
            by_source[src]["buy_amount"] += group_buy_amount
            by_source[src]["count"] += 1

            typ = group.get("trade_type", "Unknown")
            if typ not in by_type:
                by_type[typ] = {"total_net_cash": 0, "total_profit": 0, "buy_amount": 0, "count": 0}
            by_type[typ]["total_net_cash"] += net_cash
            by_type[typ]["total_profit"] += profit
            by_type[typ]["buy_amount"] += group_buy_amount
            by_type[typ]["count"] += 1

        for src, data in by_source.items():
            data["profit_percentage"] = round((data["total_profit"] / data["buy_amount"]) * 100, 2) if data["buy_amount"] else None
        for typ, data in by_type.items():
            data["profit_percentage"] = round((data["total_profit"] / data["buy_amount"]) * 100, 2) if data["buy_amount"] else None

        result = {
            "overall": {
                "total_net_cash": overall_net_cash,
                "total_profit_percentage": overall_profit_percentage,
            },
            "by_source": by_source,
            "by_type": by_type,
        }
        return jsonify(dict_keys_to_camel(result)), 200


@trades_bp.route("/stock-info/<ticker>", methods=["GET"])
def get_stock_info(ticker):
    """
    New endpoint to fetch the latest market price for a given ticker.
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
