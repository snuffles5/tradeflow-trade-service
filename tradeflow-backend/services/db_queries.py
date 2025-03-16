# services/db_queries.py
from app.models import Trade
from app.models import UnrealizedHolding
from utils.service_response import ServiceResponse


def get_active_trades():
    try:
        trades = Trade.query.filter(Trade.deleted_at.is_(None)).all()
        return ServiceResponse.success_response(trades)
    except Exception as e:
        return ServiceResponse.error_response(str(e), code=500)


def get_trade_by_id(trade_id):
    try:
        trade = Trade.query.filter(
            Trade.id == trade_id, Trade.deleted_at.is_(None)
        ).first()
        if not trade:
            return ServiceResponse.error_response("Trade not found", code=404)
        return ServiceResponse.success_response(trade)
    except Exception as e:
        return ServiceResponse.error_response(str(e), code=500)


def get_all_holdings():
    try:
        holdings = UnrealizedHolding.query.filter(Trade.deleted_at.is_(None)).all()
        return ServiceResponse.success_response(holdings)
    except Exception as e:
        return ServiceResponse.error_response(str(e), code=500)


def get_trades_by_holding_id(holding_id):
    try:
        trades = (
            Trade.query.filter(
                Trade.holding_id == holding_id, Trade.deleted_at.is_(None)
            )
            .order_by(Trade.trade_date.asc())
            .all()
        )
        return ServiceResponse.success_response(trades)
    except Exception as e:
        return ServiceResponse.error_response(str(e), code=500)


def get_active_holding(ticker, source, trade_type):
    try:
        holding = UnrealizedHolding.query.filter_by(
            ticker=ticker,
            source=source,
            trade_type=trade_type,
            close_date=None,
            deleted_at=None,
        ).first()
        return ServiceResponse.success_response(holding)
    except Exception as e:
        return ServiceResponse.error_response(str(e), code=500)


def get_holding_by_id(holding_id):
    try:
        holding = UnrealizedHolding.query.filter(
            UnrealizedHolding.id == holding_id, UnrealizedHolding.deleted_at.is_(None)
        ).first()
        if not holding:
            return ServiceResponse.error_response("Holding not found", code=404)
        return ServiceResponse.success_response(holding)
    except Exception as e:
        return ServiceResponse.error_response(str(e), code=500)
