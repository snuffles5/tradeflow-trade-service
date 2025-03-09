import json
import os

from flask import Blueprint, request, jsonify, current_app

from services.providers.factory import ProviderFactory
from services.trade_summary import merge_trades
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
        data = trade_schema.load(request.json)  # validation now expects 'trade_type' and optional 'holding_id'
    except Exception as e:
        current_app.logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400

    # Construct and save the Trade object using the updated field names.
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
    db.session.commit()

    save_to_file(new_trade)

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
    # Query all trades from the database
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
            # Fetch the current price for the ticker (cached)
            # trade_dict["current_price"] = 0  # Placeholder for the current price
            trades_list.append(trade_dict)

        # Merge similar trades (grouping by ticker, source, and trade_type)
        summary_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'trade_type'])
        return jsonify(dict_keys_to_camel(summary_data)), 200


def calculate_closed_position(group):
    """
    For closed positions (total_quantity == 0), return:
      - net_cash: displayed cost basis (flipped sign)
      - profit: realized profit (positive for gain, negative for loss)
      - profit_percentage: profit relative to the total buy amount
    """
    net_cash = group.get("total_cost", 0)
    profit = group.get("profit", 0) if group.get("profit") is not None else 0
    profit_percentage = group.get("profit_percentage", 0)
    return net_cash, profit, profit_percentage


def calculate_open_position(group):
    """
    For open positions (total_quantity != 0), use the latest available price:
      - current_price: from the first trade's 'current_price' if available, else fallback to last_price.
      - market_value: current_price * total_quantity.
      - profit: market_value - cost_basis (where cost_basis is total_cost).
      - profit_percentage: computed as ((current_price/avg_cost)-1)*100; here we return it as computed in merge_trades.
    """
    trades_in_group = group.get("trades", [])
    if trades_in_group and trades_in_group[0].get("current_price") is not None:
        current_price = trades_in_group[0]["current_price"]
    else:
        current_price = group.get("last_price", 0)
    quantity = group.get("total_quantity", 0)
    cost_basis = group.get("total_cost", 0)
    market_value = current_price * quantity
    profit = market_value - cost_basis
    if quantity > 0 and cost_basis != 0:
        profit_percentage = ((current_price / (cost_basis / quantity)) - 1) * 100
    elif quantity < 0 and current_price != 0:
        profit_percentage = ((cost_basis / quantity / current_price) - 1) * 100
    else:
        profit_percentage = 0
    return market_value, profit, profit_percentage


def aggregate_overall_metrics(merged_data):
    overall_net_cash = 0
    overall_profit = 0
    overall_buy_amount = 0

    for group in merged_data:
        quantity = group.get("total_quantity", 0)
        if quantity == 0:
            net_cash, profit, _ = calculate_closed_position(group)
        else:
            _, profit, _ = calculate_open_position(group)
            current_price = group.get("current_price") or group.get("last_price") or 0
            net_cash = current_price * quantity
        overall_net_cash += net_cash
        overall_profit += profit

        group_buy_amount = sum(
            t['quantity'] * t['price_per_unit']
            for t in group.get('trades', [])
            if t.get('transaction_type', '').lower() == 'buy'
        )
        overall_buy_amount += group_buy_amount

    overall_profit_percentage = round((overall_profit / overall_buy_amount) * 100, 2) if overall_buy_amount else None
    return overall_net_cash, overall_profit, overall_profit_percentage


@trades_bp.route("/trade-summary", methods=["GET"])
def trade_summary():
    # Query all trades from the database (assumes you have a Trade model)
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

        # Merge trades by ticker, source, and trade_type
        merged_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'trade_type'])

        # Aggregate overall metrics using our helper
        overall_net_cash, overall_profit, overall_profit_percentage = aggregate_overall_metrics(merged_data)

        # Optionally, you can add per-source and per-type aggregations as before.
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

            # Recompute group buy amount from trades
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

        # Calculate profit percentage for each source/type
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
