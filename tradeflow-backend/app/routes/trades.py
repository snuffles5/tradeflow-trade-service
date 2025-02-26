# app/routes/trades.py
from flask import Blueprint, request, jsonify
from ..database import db
from ..models import Trade
from ..schemas import TradeSchema
from datetime import date

trades_bp = Blueprint("trades_bp", __name__)

@trades_bp.route("/trades", methods=["POST"])
def create_trade():
    trade_schema = TradeSchema()

    try:
        data = trade_schema.load(request.json)  # validation
    except Exception as e:
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
            "trade_date": t.trade_date.isoformat(),
            "stop_loss": t.stop_loss,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat()
        })
    return jsonify(results), 200
