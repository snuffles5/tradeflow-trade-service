# app/models.py
from dataclasses import dataclass
from datetime import datetime

from app import db


# Association table for the many-to-many relationship between TradeSource and TradeOwner
source_owner_association = db.Table(
    "source_owner_association",
    db.Column(
        "source_id", db.Integer, db.ForeignKey("trade_sources.id"), primary_key=True
    ),
    db.Column(
        "owner_id", db.Integer, db.ForeignKey("trade_owners.id"), primary_key=True
    ),
)


class SoftDeleteMixin:
    deleted_at = db.Column(db.DateTime, nullable=True)

    def soft_delete(self):
        """Mark the record as deleted by setting deleted_at to the current timestamp."""
        self.deleted_at = datetime.utcnow()


class TradeOwner(db.Model):
    __tablename__ = "trade_owners"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(
        db.String(50), unique=True, nullable=False
    )  # e.g., Daniel, Shachar, Joint

    # Relationship back to sources (many-to-many)
    sources = db.relationship(
        "TradeSource", secondary=source_owner_association, back_populates="owners"
    )
    # Relationship back to trades (one-to-many)
    trades = db.relationship("Trade", back_populates="owner")
    holdings = db.relationship("UnrealizedHolding", back_populates="owner")

    def __repr__(self):
        return f"<TradeOwner {self.name}>"


class TradeSource(db.Model):
    __tablename__ = "trade_sources"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(
        db.String(100), unique=True, nullable=False
    )  # e.g., Interactive IL, One Zero, Blink

    # Relationship to owners (many-to-many)
    owners = db.relationship(
        "TradeOwner", secondary=source_owner_association, back_populates="sources"
    )
    # Relationship back to trades (one-to-many)
    trades = db.relationship("Trade", back_populates="source")
    holdings = db.relationship("UnrealizedHolding", back_populates="source")

    def __repr__(self):
        return f"<TradeSource {self.name}>"


class Trade(SoftDeleteMixin, db.Model):
    __tablename__ = "trades"

    id = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(
        db.String(10)
    )  # e.g., 'Buy' or 'Sell' - Keep as string for now unless normalized
    ticker = db.Column(db.String(10), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    price_per_unit = db.Column(db.Float, nullable=False)
    trade_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Foreign keys to new tables
    trade_owner_id = db.Column(
        db.Integer, db.ForeignKey("trade_owners.id"), nullable=False
    )
    trade_source_id = db.Column(
        db.Integer, db.ForeignKey("trade_sources.id"), nullable=False
    )

    # Relationships
    owner = db.relationship("TradeOwner", back_populates="trades")
    source = db.relationship("TradeSource", back_populates="trades")

    # Link to holding remains
    holding_id = db.Column(
        db.Integer, db.ForeignKey("unrealized_holdings.id"), nullable=True
    )
    holding = db.relationship(
        "UnrealizedHolding", backref="trades"
    )  # Keep backref for simplicity here or change UnrealizedHolding too

    def __repr__(self):
        owner_name = self.owner.name if self.owner else "N/A"
        source_name = self.source.name if self.source else "N/A"
        return (
            f"<Trade Owner={owner_name} Source={source_name} "
            f"{self.ticker} {self.transaction_type} {self.quantity} at {self.price_per_unit}>"
        )

    def to_dict(self):
        # Adjust to include owner/source names or IDs as needed
        data = {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
            if col.name not in ["trade_owner_id", "trade_source_id"]
        }
        data["trade_owner"] = self.owner.name if self.owner else None
        data["trade_source"] = self.source.name if self.source else None
        # Keep original IDs if needed for specific use cases
        # data['trade_owner_id'] = self.trade_owner_id
        # data['trade_source_id'] = self.trade_source_id
        return data


class LastPriceInfo(SoftDeleteMixin, db.Model):
    __tablename__ = "last_price_info"

    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    last_fetched_price = db.Column(db.Float, nullable=False)
    last_closed_price = db.Column(db.Float, nullable=True)
    source = db.Column(
        db.String(100), nullable=False
    )  # NOTE: This 'source' refers to price data source, not trade source. Keep as is.
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Optional technical indicators (ATR, SMA, RSI)
    atr = db.Column(db.Float, nullable=True)
    sma = db.Column(db.Float, nullable=True)
    rsi = db.Column(db.Float, nullable=True)

    def __repr__(self):
        return f"<LastPriceInfo {self.ticker} {self.last_fetched_price} from {self.source}>"

    def to_dict(self):
        return {col.name: getattr(self, col.name) for col in self.__table__.columns}


class UnrealizedHolding(SoftDeleteMixin, db.Model):
    __tablename__ = "unrealized_holdings"

    id = db.Column(db.Integer, primary_key=True)
    ticker = db.Column(db.String(10), nullable=False)
    # Removed: source = db.Column(db.String(100), nullable=False)
    # Removed: trade_type = db.Column(db.String(50))

    # Foreign keys to new tables
    trade_owner_id = db.Column(
        db.Integer, db.ForeignKey("trade_owners.id"), nullable=False
    )
    trade_source_id = db.Column(
        db.Integer, db.ForeignKey("trade_sources.id"), nullable=False
    )

    # Relationships
    owner = db.relationship("TradeOwner", back_populates="holdings")
    source = db.relationship("TradeSource", back_populates="holdings")

    # Aggregated fields remain
    net_quantity = db.Column(db.Float, nullable=False)
    average_cost = db.Column(db.Float, nullable=False)
    net_cost = db.Column(db.Float, nullable=False)
    latest_trade_price = db.Column(db.Float, nullable=False)
    open_date = db.Column(db.DateTime, nullable=False)
    close_date = db.Column(db.DateTime, nullable=True)
    stop_loss = db.Column(db.Float, nullable=True)

    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationship to trades (one-to-many) defined via backref in Trade model

    def __repr__(self):
        owner_name = self.owner.name if self.owner else "N/A"
        source_name = self.source.name if self.source else "N/A"
        return (
            f"<UnrealizedHolding Owner={owner_name} Source={source_name} {self.ticker}: "
            f"NetQty={self.net_quantity}, AvgCost={self.average_cost}, "
            f"NetCost={self.net_cost}, LatestPrice={self.latest_trade_price}>"
        )

    def to_dict(self):
        # Adjust to include owner/source names or IDs as needed
        data = {
            col.name: getattr(self, col.name)
            for col in self.__table__.columns
            if col.name not in ["trade_owner_id", "trade_source_id"]
        }
        data["trade_owner"] = self.owner.name if self.owner else None
        data["trade_source"] = self.source.name if self.source else None
        # Keep original IDs if needed
        # data['trade_owner_id'] = self.trade_owner_id
        # data['trade_source_id'] = self.trade_source_id
        return data


@dataclass
class Stock:
    price: float
    change_today: float
    change_today_percentage: float
    last_updated: datetime


# Keep Transaction Type constants here for now, or move to a dedicated table later if needed
class TradeTransactionType:
    sell = "Sell"
    buy = "Buy"
