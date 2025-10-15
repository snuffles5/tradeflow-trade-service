import json
from datetime import datetime

from app import create_app
from app import db
from app.models import Trade
from app.models import TradeOwner
from app.models import TradeSource
from services.trade_holdings import update_unrealized_holding
from utils.consts import TRADES_JSON_FILE_PATH


TRADE_DATE_FORMAT = "%m/%d/%Y"


def _parse_date(value: str) -> datetime:
    if not value:
        return None
    return datetime.strptime(value, TRADE_DATE_FORMAT)


def _get_owner(session, owner_name: str) -> TradeOwner:
    owner = session.query(TradeOwner).filter_by(name=owner_name).one_or_none()
    if owner is None:
        owner = TradeOwner(name=owner_name)
        session.add(owner)
        session.flush()
    return owner


def _get_source(session, source_name: str, owner: TradeOwner) -> TradeSource:
    source = session.query(TradeSource).filter_by(name=source_name).one_or_none()
    if source is None:
        source = TradeSource(name=source_name)
        session.add(source)
        session.flush()
    if owner not in source.owners:
        source.owners.append(owner)
        session.flush()
    return source


def _load_trade_records():
    with open(TRADES_JSON_FILE_PATH) as file:
        trades = json.load(file)

    def get_trade_datetime(item, key_candidates):
        for key in key_candidates:
            if key in item and item[key]:
                return _parse_date(item[key])
        return None

    def normalize_owner(item):
        return (item.get("trade_owner") or item.get("trade_type") or "Unknown").strip()

    def normalize_source(item):
        return (item.get("trade_source") or item.get("source") or "Unknown").strip()

    normalized = []
    for raw in trades:
        owner_name = normalize_owner(raw)
        source_name = normalize_source(raw)

        created_at = get_trade_datetime(raw, ["created_at"])
        updated_at = get_trade_datetime(raw, ["updated_at", "created_at"])
        trade_date = get_trade_datetime(raw, ["trade_date", "date", "created_at"])

        try:
            price = float(raw["price_per_unit"])
            quantity = float(raw["quantity"])
        except (KeyError, TypeError, ValueError):
            raise ValueError(f"Invalid numeric values in seed record: {raw}")

        normalized.append(
            {
                "owner_name": owner_name,
                "source_name": source_name,
                "transaction_type": raw.get("transaction_type", "Buy"),
                "ticker": raw.get("ticker", "").upper(),
                "quantity": quantity,
                "price_per_unit": price,
                "trade_date": trade_date or created_at,
                "created_at": created_at or trade_date,
                "updated_at": updated_at or trade_date,
            }
        )

    normalized.sort(key=lambda item: item["trade_date"] or datetime.min)
    return normalized


def load_data():
    """Load base data from TRADES_JSON_FILE_PATH into the database and update unrealized holdings."""

    app = create_app()
    with app.app_context():
        session = db.session
        records = _load_trade_records()

        for item in records:
            owner = _get_owner(session, item["owner_name"])
            source = _get_source(session, item["source_name"], owner)

            trade = Trade(
                transaction_type=item["transaction_type"],
                ticker=item["ticker"],
                quantity=item["quantity"],
                price_per_unit=item["price_per_unit"],
                trade_date=item["trade_date"],
                created_at=item["created_at"],
                updated_at=item["updated_at"],
                trade_owner_id=owner.id,
                trade_source_id=source.id,
                holding_id=None,
            )

            session.add(trade)
            session.flush()

            update_unrealized_holding(trade)

        session.commit()
        session.close()
        print("Base data loaded successfully.")


if __name__ == "__main__":
    load_data()
