import json
from datetime import datetime

from app import create_app, db
from app.models import Trade
from services.trade_holdings import update_unrealized_holding
from utils.consts import TRADES_JSON_FILE_PATH


def load_data():
    """Load base data from TRADES_JSON_FILE_PATH into the database and update unrealized holdings."""
    app = create_app()
    with app.app_context():
        with open(TRADES_JSON_FILE_PATH, 'r') as f:
            data = json.load(f)

        # Sort trades chronologically by trade_date (assuming format is MM/DD/YYYY)
        data.sort(key=lambda item: datetime.strptime(item['trade_date'], "%m/%d/%Y"))

        session = db.session

        for item in data:
            # Convert legacy field "type" to new "trade_type"
            if 'type' in item:
                item['trade_type'] = item.pop('type')
            # Parse created_at (and use it for trade_date if not provided)
            if 'created_at' in item and item['created_at']:
                item['created_at'] = datetime.strptime(item['created_at'], "%m/%d/%Y")
            # Set updated_at (default to created_at if missing)
            if 'updated_at' not in item or not item['updated_at']:
                item['updated_at'] = item['created_at']
            else:
                item['updated_at'] = datetime.strptime(item['updated_at'], "%m/%d/%Y")
            # Set trade_date from 'date' if available, otherwise use created_at
            if 'date' in item:
                item['trade_date'] = datetime.strptime(item.pop('date'), "%m/%d/%Y")
            else:
                item['trade_date'] = item['created_at']
            # Ensure holding_id is present (it will be updated by the holdings logic)
            item['holding_id'] = None
            # Convert numeric fields
            item['price_per_unit'] = float(item['price_per_unit'])
            item['quantity'] = float(item['quantity'])

            trade = Trade(**item)
            session.add(trade)
            session.flush()  # Ensure trade gets an ID

            # Update unrealized holding based on this trade.
            update_unrealized_holding(trade)

        session.commit()
        session.close()
        print("Base data loaded successfully.")


if __name__ == '__main__':
    load_data()
