# scripts/recalculate_holdings.py
import os
import sys

from app import create_app
from app import db
from app.models import UnrealizedHolding
from services.trade_holdings import recalc_unrealized_holding
from utils.logger import log

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)


def recalculate_all_holdings():
    """
    Iterates through all UnrealizedHolding records and recalculates their state,
    including net quantity, cost, average cost, dates, and realized PnL,
    based on their associated trades.
    """
    app = create_app()
    with app.app_context():
        log.info("Starting recalculation of all holdings...")
        holdings = UnrealizedHolding.query.all()
        count = 0
        errors = 0

        if not holdings:
            log.info("No holdings found to recalculate.")
            return

        for holding in holdings:
            try:
                log.debug(
                    f"Recalculating holding ID: {holding.id}, Ticker: {holding.ticker}..."
                )
                recalc_unrealized_holding(holding)
                count += 1
            except Exception as e:
                log.error(
                    f"Error recalculating holding ID {holding.id}: {e}", exc_info=True
                )
                errors += 1
                # Optional: Rollback transaction for this specific holding if needed,
                # but usually better to commit successful ones and report errors.
                db.session.rollback()  # Rollback the specific error

        try:
            log.info("Committing changes...")
            db.session.commit()
            log.info(f"Successfully recalculated {count} holdings.")
            if errors > 0:
                log.warning(
                    f"Failed to recalculate {errors} holdings. Check logs for details."
                )
        except Exception as e:
            log.error(f"Failed to commit recalculation changes: {e}", exc_info=True)
            db.session.rollback()


if __name__ == "__main__":
    recalculate_all_holdings()
