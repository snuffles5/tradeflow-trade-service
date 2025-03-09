import json
import argparse
from datetime import datetime
from sqlalchemy import text

from app import create_app, db
from app.models import Trade  # Ensure correct import


def load_data(file_path):
    """Load base data from a JSON file and insert it into the database."""

    app = create_app()  # Create Flask app context
    with app.app_context():  # Ensure MySQL connection
        with open(file_path, 'r') as f:
            data = json.load(f)

        session = db.session  # Use Flask-SQLAlchemy's session

        for item in data:
            if 'created_at' in item and item['created_at']:
                item['created_at'] = datetime.strptime(item['created_at'], "%m/%d/%Y")
                item['date'] = item['created_at']

            if 'updated_at' in item and item['updated_at']:
                item['updated_at'] = datetime.strptime(item['updated_at'], "%m/%d/%Y")

            trade = Trade(**item)
            session.add(trade)

        session.commit()
        session.close()
        print("Base data loaded successfully.")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Load base data into the database")
    parser.add_argument('--file', type=str, required=True, help="Path to JSON file containing base data")
    args = parser.parse_args()

    app = create_app()  # Create Flask app
    with app.app_context():  # Use MySQL connection
        with db.engine.connect() as connection:
            result = connection.execute(text("SHOW TABLES;"))  # Use MySQL syntax
            tables = result.fetchall()
            print("Existing tables:", [table[0] for table in tables])

        # Call function to load data
        load_data(args.file)
