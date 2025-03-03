# app/routes/trades.py
from flask import Blueprint, request, jsonify, current_app

from services.price_provider import PriceProvider
from services.trade_summary import merge_trades
from ..database import db
from ..models import Trade
from ..schemas import TradeSchema

trades_bp = Blueprint("trades_bp", __name__)

# Instantiate the price provider (with 5 minutes caching)
price_provider = PriceProvider(cache_duration=300)

@trades_bp.route("/trades", methods=["POST"])
def create_trade():
    trade_schema = TradeSchema()

    try:
        data = trade_schema.load(request.json)  # validation
    except Exception as e:
        current_app.logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400

    # Construct and save the Trade object
    new_trade = Trade(
        type=data["type"],
        source=data["source"],
        transaction_type=data["transactionType"],
        ticker=data["ticker"],
        quantity=data["quantity"],
        price_per_unit=data["pricePerUnit"],
        trade_date=data["date"],  # already a date object from Marshmallow
        stop_loss=data["stopLoss"]
    )

    db.session.add(new_trade)
    db.session.commit()

    current_app.logger.info(f"Trade created with ID: {new_trade.id}")
    return jsonify({"message": "Trade created", "trade_id": new_trade.id}), 201


@trades_bp.route("/trades", methods=["GET"])
def list_trades():
    trades = Trade.query.all()
    # For demonstration, just return a list of dicts
    results = []
    for t in trades:
        results.append({
            "id": t.id,
            "type": t.type,
            "source": t.source,
            "transaction_type": t.transaction_type,
            "ticker": t.ticker,
            "quantity": t.quantity,
            "price_per_unit": t.price_per_unit,
            "stop_loss": t.stop_loss,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat()
        })
    current_app.logger.info("Fetched all trades")
    return jsonify(results), 200


@trades_bp.route("/aggregated-trades", methods=["GET"])
def aggregated_trades():
    # Query all trades from the database
    trades = Trade.query.all()
    trades_list = []
    for trade in trades:
        # Format created_at as MM/DD/YYYY
        created_at_str = trade.created_at.strftime("%m/%d/%Y") if trade.created_at else None

        trade_dict = {
            "ticker": trade.ticker,
            "source": trade.source,
            "type": trade.type,
            "quantity": trade.quantity,
            "price_per_unit": trade.price_per_unit,
            "created_at": created_at_str,
            "transaction_type": trade.transaction_type,
        }
        # Fetch the current price for the ticker (cached)
        # trade_dict["currentPrice"] = 0 # Placeholder for the current price
        trades_list.append(trade_dict)

    # Merge similar trades (grouping by ticker, source, and type)
    summary_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'type'])
    return jsonify(summary_data), 200


@trades_bp.route("/trade-summary", methods=["GET"])
def trade_summary():
    # Query all trades from the database
    trades = Trade.query.all()
    trades_list = []
    for trade in trades:
        created_at_str = trade.created_at.strftime("%m/%d/%Y") if trade.created_at else None
        trade_dict = {
            "ticker": trade.ticker,
            "source": trade.source,
            "type": trade.type,
            "quantity": trade.quantity,
            "price_per_unit": trade.price_per_unit,
            "created_at": created_at_str,
            "transaction_type": trade.transaction_type,
        }
        # Get the current price for the ticker (from your price provider)
        # trade_dict["currentPrice"] = 0
        trades_list.append(trade_dict)

    # Merge trades by ticker, source, and type (using your existing merge_trades function)
    merged_data = merge_trades(trades_list, merge_keys=['ticker', 'source', 'type'])

    overall_net_cash = 0
    overall_profit = 0
    overall_buy_amount = 0

    by_source = {}
    by_type = {}

    for group in merged_data:
        # Determine if the position is closed (totalQuantity is zero) or open.
        quantity = group.get("totalQuantity", 0)
        if quantity == 0:
            # Closed position: use the computed totalCost and profit
            net_cash = group.get("totalCost", 0)
            profit = group.get("profit", 0) if group.get("profit") is not None else 0
        else:
            # Open position: compute net cash as current market value.
            # Assuming all trades in the group have the same currentPrice, we take the first one.
            trades_in_group = group.get("trades", [])
            if trades_in_group and trades_in_group[0].get("currentPrice") is not None:
                current_price = trades_in_group[0]["currentPrice"]
            else:
                current_price = group.get("lastPrice", 0)
            # The current market value is:
            net_cash = current_price * quantity
            # Unrealized profit/loss is the difference from the original cost basis.
            # Note: For open trades, merge_trades sets totalCost as the cost basis.
            profit = net_cash - group.get("totalCost", 0)

        overall_net_cash += net_cash
        overall_profit += profit

        # Recompute group buy amount from trades (if merge_trades removed it)
        group_buy_amount = sum(
            t['quantity'] * t['price_per_unit']
            for t in group.get('trades', [])
            if t.get('transaction_type', '').lower() == 'buy'
        )
        overall_buy_amount += group_buy_amount

        # Aggregate per source
        src = group.get("source", "Unknown")
        if src not in by_source:
            by_source[src] = {"totalNetCash": 0, "totalProfit": 0, "buyAmount": 0, "count": 0}
        by_source[src]["totalNetCash"] += net_cash
        by_source[src]["totalProfit"] += profit
        by_source[src]["buyAmount"] += group_buy_amount
        by_source[src]["count"] += 1

        # Aggregate per type
        typ = group.get("type", "Unknown")
        if typ not in by_type:
            by_type[typ] = {"totalNetCash": 0, "totalProfit": 0, "buyAmount": 0, "count": 0}
        by_type[typ]["totalNetCash"] += net_cash
        by_type[typ]["totalProfit"] += profit
        by_type[typ]["buyAmount"] += group_buy_amount
        by_type[typ]["count"] += 1

    overall_profit_percentage = round((overall_profit / overall_buy_amount) * 100, 2) if overall_buy_amount else None

    # Calculate profit percentage for each group
    for src, data in by_source.items():
        data["profitPercentage"] = round((data["totalProfit"] / data["buyAmount"]) * 100, 2) if data["buyAmount"] else None
    for typ, data in by_type.items():
        data["profitPercentage"] = round((data["totalProfit"] / data["buyAmount"]) * 100, 2) if data["buyAmount"] else None

    result = {
        "overall": {
            "totalNetCash": overall_net_cash,
            "totalProfitPercentage": overall_profit_percentage,
        },
        "bySource": by_source,
        "byType": by_type,
    }
    return jsonify(result), 200


@trades_bp.route("/last-price/<ticker>", methods=["GET"])
def get_last_price(ticker):
    """
    New endpoint to fetch the latest market price for a given ticker.
    """
    try:
        # Use the existing price provider (with caching) to get the latest price.
        price = price_provider.get_price(ticker)
        return jsonify({"ticker": ticker, "lastPrice": price}), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching last price for {ticker}: {str(e)}")
        return jsonify({"error": "Failed to get last price"}), 500
