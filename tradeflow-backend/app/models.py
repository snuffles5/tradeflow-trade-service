# app/models.py
from dataclasses import dataclass
from datetime import datetime

from app import db


class SoftDeleteMixin:
    deleted_at = db.Column(db.DateTime, nullable=True)

    def soft_delete(self):
        """Mark the record as deleted by setting deleted_at to the current timestamp."""
        self.deleted_at = datetime.utcnow()


class Trade(SoftDeleteMixin, db.Model):
    __tablename__ = 'trades'

    id = db.Column(db.Integer, primary_key=True)
    trade_type = db.Column(db.String(50))  # e.g., 'Personal' or 'Joint'
    source = db.Column(db.String(100))
    transaction_type = db.Column(db.String(10))  # e.g., 'Buy' or 'Sell'
    ticker = db.Column(db.String(10), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    price_per_unit = db.Column(db.Float, nullable=False)
    trade_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # New field to link a trade with its aggregated unrealized holding (if applicable)
    holding_id = db.Column(db.Integer, db.ForeignKey('unrealized_holdings.id'), nullable=True)
    holding = db.relationship('UnrealizedHolding', backref='trades')

    def __repr__(self):
        return f"<Trade {self.ticker} {self.transaction_type} {self.quantity} at {self.price_per_unit}>"


class LastPriceInfo(SoftDeleteMixin, db.Model):
    __tablename__ = 'last_price_info'

    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    last_fetched_price = db.Column(db.Float, nullable=False)
    last_closed_price = db.Column(db.Float, nullable=True)
    source = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Optional technical indicators (ATR, SMA, RSI)
    atr = db.Column(db.Float, nullable=True)
    sma = db.Column(db.Float, nullable=True)
    rsi = db.Column(db.Float, nullable=True)

    def __repr__(self):
        return f"<LastPriceInfo {self.ticker} {self.last_fetched_price} from {self.source}>"


class UnrealizedHolding(SoftDeleteMixin, db.Model):
    __tablename__ = 'unrealized_holdings'

    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    source = db.Column(db.String(100), nullable=False)
    trade_type = db.Column(db.String(50))

    # New aggregated fields
    net_quantity = db.Column(db.Float, nullable=False)  # renamed from total_holding
    average_cost = db.Column(db.Float, nullable=False)  # weighted average cost per share
    net_cost = db.Column(db.Float, nullable=False)  # total cost basis (e.g. sum(quantity * price))
    latest_trade_price = db.Column(db.Float, nullable=False)
    open_date = db.Column(db.DateTime, nullable=False)
    close_date = db.Column(db.DateTime, nullable=True)
    stop_loss = db.Column(db.Float, nullable=True)

    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return (f"<UnrealizedHolding {self.ticker} {self.trade_type}: "
                f"NetQty={self.net_quantity}, AvgCost={self.average_cost}, "
                f"NetCost={self.net_cost}, LatestPrice={self.latest_trade_price}>")


@dataclass
class Stock:
    price: float
    change_today: float
    change_today_percentage: float
    last_updated: datetime
