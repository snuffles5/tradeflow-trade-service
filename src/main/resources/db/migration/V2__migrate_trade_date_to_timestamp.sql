-- Migrate trades.trade_date from DATE to TIMESTAMP (UTC)
-- Existing DATE values will become TIMESTAMP at 00:00:00 of that date.
ALTER TABLE trades
    MODIFY COLUMN trade_date TIMESTAMP NOT NULL;

-- Backfill existing rows to set the timestamp to midnight UTC
UPDATE trades
SET trade_date = TIMESTAMP(DATE(trade_date));
