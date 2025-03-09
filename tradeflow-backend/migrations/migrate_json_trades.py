import json
import os

from utils.consts import TRADES_JSON_FILE_PATH


def migrate_trade_record(trade):
    # Rename legacy field "type" to "trade_type"
    if "type" in trade:
        trade["trade_type"] = trade.pop("type")
    # Ensure trade_date exists: use 'date' if available, else default to created_at
    if "trade_date" not in trade:
        if "date" in trade:
            trade["trade_date"] = trade.pop("date")
        elif "created_at" in trade:
            trade["trade_date"] = trade["created_at"]
    # Ensure updated_at exists
    if "updated_at" not in trade or not trade["updated_at"]:
        trade["updated_at"] = trade.get("created_at")
    # Add holding_id if missing
    if "holding_id" not in trade:
        trade["holding_id"] = None
    return trade


def migrate_json_file():
    if not os.path.exists(TRADES_JSON_FILE_PATH):
        print(f"File {TRADES_JSON_FILE_PATH} does not exist.")
        return
    with open(TRADES_JSON_FILE_PATH, "r") as f:
        try:
            trades = json.load(f)
        except json.JSONDecodeError:
            print("Invalid JSON format in the file.")
            return

    migrated_trades = [migrate_trade_record(trade) for trade in trades]
    with open(TRADES_JSON_FILE_PATH, "w") as f:
        json.dump(migrated_trades, f, indent=2)
    print("Migration completed successfully.")


if __name__ == '__main__':
    migrate_json_file()
