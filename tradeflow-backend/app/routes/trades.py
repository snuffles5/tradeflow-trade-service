import json
import os

from flask import Blueprint, request, jsonify, current_app

from services.providers.factory import ProviderFactory
from services.trade_summary import merge_trades
from utils.consts import DATA_FOLDER_PATH
from ..database import db
from app.models import Trade
from app.schemas import TradeSchema

trades_bp = Blueprint("trades_bp", __name__)

# Instantiate the price provider (with 5 minutes caching)
provider_factory = ProviderFactory(cache_duration=300)

TRADES_JSON_FILE = DATA_FOLDER_PATH / "trades.json"


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
    if os.path.exists(TRADES_JSON_FILE):
        with open(TRADES_JSON_FILE, "r") as file:
            try:
                trades_list = json.load(file)
            except json.JSONDecodeError:
                trades_list = []  # Reset if JSON is corrupted
    else:
        trades_list = []

    # Append the new record and save
    trades_list.append(trade_record)
    try:
        with open(TRADES_JSON_FILE, "w") as file:
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
    return jsonify({"message": "Trade created", "trade_id": new_trade.id}), 201


@trades_bp.route("/trades", methods=["GET"])
def list_trades():
    with current_app.app_context():
        trades = Trade.query.all()
        results = []
        for t in trades:
            results.append({
                "id": t.id,
                "tradeType": t.trade_type,
                "source": t.source,
                "transactionType": t.transaction_type,
                "ticker": t.ticker,
                "quantity": t.quantity,
                "pricePerUnit": t.price_per_unit,
                "tradeDate": t.trade_date.isoformat(),
                "createdAt": t.created_at.isoformat(),
                "updatedAt": t.updated_at.isoformat(),
                "holdingId": t.holding_id,
            })
        current_app.logger.info("Fetched all trades")
        return jsonify(results), 200


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
                "tradeType": trade.trade_type,
                "quantity": trade.quantity,
                "pricePerUnit": trade.price_per_unit,
                "tradeDate": trade_date_str,
                "transactionType": trade.transaction_type,
            }
            # Fetch the current price for the ticker (cached)
            # trade_dict["currentPrice"] = 0 # Placeholder for the current price
            trades_list.append(trade_dict)

        # Merge similar trades (grouping by ticker, source, and type)
        summary_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'type'])
        return jsonify(summary_data), 200


def calculate_closed_position(group):
    """
    For closed positions (totalQuantity == 0), return:
      - net_cash: displayed cost basis (flipped sign)
      - profit: realized profit (positive for gain, negative for loss)
      - profit_percentage: profit relative to the total buy amount
    """
    net_cash = group.get("totalCost", 0)
    profit = group.get("profit", 0) if group.get("profit") is not None else 0
    # profitPercentage is computed in merge_trades; return it as is.
    profit_percentage = group.get("profitPercentage", 0)
    return net_cash, profit, profit_percentage


def calculate_open_position(group):
    """
    For open positions (totalQuantity != 0), use the latest available price:
      - current_price: from the first trade's 'currentPrice' if available, else fallback to lastPrice.
      - market_value: current_price * totalQuantity.
      - profit: market_value - cost_basis (where cost_basis is totalCost).
      - profit_percentage: computed as ((current_price/avgCost)-1)*100; here we return it as computed in merge_trades.
    """
    trades_in_group = group.get("trades", [])
    if trades_in_group and trades_in_group[0].get("currentPrice") is not None:
        current_price = trades_in_group[0]["currentPrice"]
    else:
        current_price = group.get("lastPrice", 0)
    quantity = group.get("totalQuantity", 0)
    cost_basis = group.get("totalCost", 0)
    market_value = current_price * quantity
    profit = market_value - cost_basis
    # Let profit_percentage be computed as in merge_trades
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
        quantity = group.get("totalQuantity", 0)
        if quantity == 0:
            net_cash, profit, _ = calculate_closed_position(group)
        else:
            _, profit, _ = calculate_open_position(group)
            net_cash = group.get("currentPrice", group.get("lastPrice", 0)) * quantity
        overall_net_cash += net_cash
        overall_profit += profit

        # Recompute group buy amount from trades (only summing for buy trades)
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
                "tradeType": trade.trade_type,  # updated field name
                "quantity": trade.quantity,
                "pricePerUnit": trade.price_per_unit,
                "tradeDate": trade_date_str,
                "transactionType": trade.transaction_type,
                "holdingId": trade.holding_id,
                "currentPrice": provider_factory.get_price(trade.ticker) if trade.quantity != 0 else None
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
            quantity = group.get("totalQuantity", 0)
            if quantity == 0:
                net_cash, profit, _ = calculate_closed_position(group)
            else:
                _, profit, _ = calculate_open_position(group)
                net_cash = group.get("currentPrice", group.get("lastPrice", 0)) * quantity

            # Recompute group buy amount from trades
            group_buy_amount = sum(
                t['quantity'] * t['price_per_unit']
                for t in group.get('trades', [])
                if t.get('transaction_type', '').lower() == 'buy'
            )

            src = group.get("source", "Unknown")
            if src not in by_source:
                by_source[src] = {"totalNetCash": 0, "totalProfit": 0, "buyAmount": 0, "count": 0}
            by_source[src]["totalNetCash"] += net_cash
            by_source[src]["totalProfit"] += profit
            by_source[src]["buyAmount"] += group_buy_amount
            by_source[src]["count"] += 1

            typ = group.get("trade_type", "Unknown")
            if typ not in by_type:
                by_type[typ] = {"totalNetCash": 0, "totalProfit": 0, "buyAmount": 0, "count": 0}
            by_type[typ]["totalNetCash"] += net_cash
            by_type[typ]["totalProfit"] += profit
            by_type[typ]["buyAmount"] += group_buy_amount
            by_type[typ]["count"] += 1

        # Calculate profit percentage for each source/type
        for src, data in by_source.items():
            data["profitPercentage"] = round((data["totalProfit"] / data["buyAmount"]) * 100, 2) if data[
                "buyAmount"] else None
        for typ, data in by_type.items():
            data["profitPercentage"] = round((data["totalProfit"] / data["buyAmount"]) * 100, 2) if data[
                "buyAmount"] else None

        result = {
            "overall": {
                "totalNetCash": overall_net_cash,
                "totalProfitPercentage": overall_profit_percentage,
            },
            "bySource": by_source,
            "byType": by_type,
        }
        return jsonify(result), 200


@trades_bp.route("/stock-info/<ticker>", methods=["GET"])
def get_stock_info(ticker):
    """
    New endpoint to fetch the latest market price for a given ticker.
    """
    try:
        # Use the existing price provider (with caching) to get the latest price.
        stock = provider_factory.get_stock(ticker)
        return jsonify({"ticker": ticker, "lastPrice": stock.price,
                        "changeToday": stock.change_today,
                        "changeTodayPercentage": stock.change_today_percentage,
                        }), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching last price for {ticker}: {str(e)}")
        return jsonify({"error": "Failed to get last price"}), 500
