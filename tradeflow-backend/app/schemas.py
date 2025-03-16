# app/schemas.py
from datetime import datetime

from app.models import LastPriceInfo
from app.models import Trade
from app.models import UnrealizedHolding
from marshmallow import fields
from marshmallow import post_load
from marshmallow import Schema
from utils.logger import log


class TradeSchema(Schema):
    id = fields.Int(dump_only=True)
    trade_type = fields.Str(required=True)
    source = fields.Str(required=True)
    transaction_type = fields.Str(required=True)
    ticker = fields.Str(required=True)
    quantity = fields.Float(required=True)
    price_per_unit = fields.Float(required=True)
    trade_date = fields.DateTime(
        format="%Y-%m-%d", missing=lambda: datetime.utcnow()
    )  # Default to current UTC time
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)
    holding_id = fields.Int(allow_none=True)  # new foreign key

    @post_load
    def make_trade(self, data, **kwargs):
        log.trace(f"Making trade with data: {data}, kwargs: {kwargs}")
        return Trade(**data)


class LastPriceInfoSchema(Schema):
    id = fields.Int(dump_only=True)
    ticker = fields.Str(required=True)
    last_fetched_price = fields.Float(required=True)
    last_closed_price = fields.Float(allow_none=True)
    source = fields.Str(required=True)
    created_at = fields.DateTime(dump_only=True)
    atr = fields.Float(allow_none=True)
    sma = fields.Float(allow_none=True)
    rsi = fields.Float(allow_none=True)

    @post_load
    def make_last_price_info(self, data, **kwargs):
        return LastPriceInfo(**data)


class UnrealizedHoldingSchema(Schema):
    id = fields.Int(dump_only=True)
    ticker = fields.Str(required=True)
    source = fields.Str(required=True)
    trade_type = fields.Str(required=True)
    net_quantity = fields.Float(required=True)
    average_cost = fields.Float(required=True)
    net_cost = fields.Float(required=True)
    latest_trade_price = fields.Float(required=True)
    open_date = fields.DateTime(allow_none=False)
    close_date = fields.DateTime(allow_none=True)
    stop_loss = fields.Float(allow_none=True)
    updated_at = fields.DateTime(dump_only=True)

    @post_load
    def make_unrealized_holding(self, data, **kwargs):
        return UnrealizedHolding(**data)
