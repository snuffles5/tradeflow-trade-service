# scripts/seed_data.py
import json
from datetime import datetime

from app import create_app
from app import db
from app.models import source_owner_association
from app.models import Trade
from app.models import TradeOwner
from app.models import TradeSource
from app.models import UnrealizedHolding
from services.trade_holdings import update_unrealized_holding
from sqlalchemy import delete
from sqlalchemy import inspect
from utils.consts import TRADES_JSON_FILE_PATH
from utils.logger import log


def load_data():
    """Load base data from TRADES_JSON_FILE_PATH into the database and update unrealized holdings."""
    app = create_app()
    with app.app_context():
        session = db.session
        inspector = inspect(db.engine)

        # 1) Ensure tables exist
        if not inspector.has_table("trades"):
            log.info("No 'trades' table found; creating all tables.")
            db.create_all()
        else:
            # If there's any existing Trade, clear all data
            if session.query(Trade).first():
                log.warning("Existing data detected; clearing all tables.")
                # Clear association first
                session.execute(delete(source_owner_association))
                # Then child tables
                session.query(Trade).delete(synchronize_session=False)
                session.query(UnrealizedHolding).delete(synchronize_session=False)
                session.query(TradeSource).delete(synchronize_session=False)
                session.query(TradeOwner).delete(synchronize_session=False)
                session.commit()
                log.info("All tables truncated, ready to reseed.")
            else:
                log.info("'trades' table exists but is empty; skipping truncate.")

        # 2) Load & sort JSON
        log.info("Loading %s", TRADES_JSON_FILE_PATH)
        with open(TRADES_JSON_FILE_PATH) as f:
            data = json.load(f)
        data.sort(key=lambda item: datetime.strptime(item["trade_date"], "%m/%d/%Y"))
        total = len(data)
        log.info("Loaded %d trade records", total)

        # 3) Ensure a default owner & source
        default_owner = (
            session.query(TradeOwner).filter_by(name="Default").one_or_none()
        )
        if not default_owner:
            default_owner = TradeOwner(name="Default")
            session.add(default_owner)
            session.flush()
            log.info("Created default TradeOwner (id=%d)", default_owner.id)

        default_source = (
            session.query(TradeSource).filter_by(name="Default").one_or_none()
        )
        if not default_source:
            default_source = TradeSource(name="Default")
            session.add(default_source)
            session.flush()
            log.info("Created default TradeSource (id=%d)", default_source.id)

        # 4) Seed each trade
        for idx, raw in enumerate(data, start=1):
            log.info("Seeding trade %d/%d…", idx, total)
            item = dict(raw)
            item.pop("trade_type", None)
            item.pop("holding_id", None)

            # Owner logic
            owner_name = item.pop("trade_owner", None)
            if owner_name:
                owner = (
                    session.query(TradeOwner).filter_by(name=owner_name).one_or_none()
                )
                if not owner:
                    owner = TradeOwner(name=owner_name)
                    session.add(owner)
                    session.flush()
                    log.info("  Created TradeOwner '%s' (id=%d)", owner_name, owner.id)
            else:
                owner = default_owner
            item["trade_owner_id"] = owner.id

            # Source logic
            source_name = item.pop("trade_source", None) or item.pop("source", None)
            if source_name:
                source = (
                    session.query(TradeSource).filter_by(name=source_name).one_or_none()
                )
                if not source:
                    source = TradeSource(name=source_name)
                    session.add(source)
                    session.flush()
                    log.info(
                        "  Created TradeSource '%s' (id=%d)", source_name, source.id
                    )
            else:
                source = default_source
            item["trade_source_id"] = source.id

            # Link owner<->source
            if owner not in source.owners:
                source.owners.append(owner)
                session.flush()
                log.info(
                    "  Linked Source(id=%d,'%s') ↔ Owner(id=%d,'%s')",
                    source.id,
                    source.name,
                    owner.id,
                    owner.name,
                )

            # Date parsing
            if c := item.get("created_at"):
                item["created_at"] = datetime.strptime(c, "%m/%d/%Y")
            if not item.get("updated_at"):
                item["updated_at"] = item["created_at"]
            else:
                item["updated_at"] = datetime.strptime(item["updated_at"], "%m/%d/%Y")
            if "date" in item:
                item["trade_date"] = datetime.strptime(item.pop("date"), "%m/%d/%Y")
            else:
                item["trade_date"] = item["created_at"]

            # Reset holding_id
            item["holding_id"] = None

            # Numeric casts
            item["price_per_unit"] = float(item["price_per_unit"])
            item["quantity"] = float(item["quantity"])

            # Persist trade
            trade = Trade(**item)
            session.add(trade)
            session.flush()
            log.info(
                "  Inserted Trade id=%d: %s %s %0.4f @ %0.2f",
                trade.id,
                trade.transaction_type,
                trade.ticker,
                trade.quantity,
                trade.price_per_unit,
            )

            # Update holdings
            log.info("  Updating unrealized holding for Trade id=%d", trade.id)
            update_unrealized_holding(trade)

        # 5) Commit
        session.commit()
        session.close()
        log.info("Seeding complete; %d trades committed.", total)


if __name__ == "__main__":
    load_data()
