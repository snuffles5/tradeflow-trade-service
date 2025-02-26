# app/models.py
from .database import db
from datetime import datetime

class Trade(db.Model):
    __tablename__ = "trades"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    type = db.Column(db.String(20), nullable=False)  # e.g., "Private" or "Joint"
    source = db.Column(db.String(50), nullable=False)  # e.g., "Interactive IL", "One Zero"
    transaction_type = db.Column(db.String(10), nullable=False)  # e.g., "Buy", "Sell"
    ticker = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    price_per_unit = db.Column(db.Float, nullable=False)
    trade_date = db.Column(db.Date, nullable=False)  # store only the date
    stop_loss = db.Column(db.Float, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Trade {self.id} - {self.ticker}>"
