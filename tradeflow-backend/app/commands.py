import click
from app.database import db
from app.models import UnrealizedHolding
from flask.cli import with_appcontext
from services.trade_holdings import recalc_unrealized_holding
from utils.logger import log

# You might need to register this blueprint or commands with your Flask app instance
# in your main __init__.py or app factory function.
# Example (in create_app function):
# from . import commands
# app.cli.add_command(commands.reprocess_holdings_command)


@click.command("reprocess-holdings")
@with_appcontext
def reprocess_holdings_command():
    """Recalculate and update all UnrealizedHolding records."""
    log.info("Starting reprocessing of all UnrealizedHolding records...")
    holdings = UnrealizedHolding.query.all()
    updated_count = 0
    skipped_count = 0  # Note: recalc function handles skipping if no trades are found
    error_count = 0

    if not holdings:
        log.info("No holdings found to reprocess.")
        return

    log.info(f"Found {len(holdings)} holdings to process.")

    for holding in holdings:
        log.debug(f"Processing holding ID: {holding.id}, Ticker: {holding.ticker}")
        try:
            # recalc_unrealized_holding modifies the holding object in place
            # and handles adding to the session.
            recalculated_holding = recalc_unrealized_holding(holding)
            # The function now returns None if the holding was deleted (no trades)
            if recalculated_holding is None:
                skipped_count += 1
                log.debug(f"Skipped/deleted holding ID: {holding.id}")
            else:
                updated_count += 1
                log.debug(f"Successfully processed holding ID: {holding.id}")
        except Exception as e:
            log.error(f"Error reprocessing holding ID {holding.id}: {e}", exc_info=True)
            db.session.rollback()  # Rollback changes for this specific holding on error
            error_count += 1
            # Continue to the next holding

    try:
        db.session.commit()
        log.info(
            f"Finished reprocessing. Updated: {updated_count}, Skipped/deleted: {skipped_count}, Errors: {error_count}"
        )
    except Exception as e:
        log.error(f"Failed to commit changes after reprocessing: {e}", exc_info=True)
        db.session.rollback()
        log.info("Rolled back session due to commit error.")


def register_commands(app):
    """Registers CLI commands with the Flask app."""
    app.cli.add_command(reprocess_holdings_command)
