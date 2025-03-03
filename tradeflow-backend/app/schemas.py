# app/schemas.py
from marshmallow import Schema, fields, validates_schema, ValidationError
from datetime import datetime


class TradeSchema(Schema):
    type = fields.Str(required=True)
    source = fields.Str(required=True)
    transactionType = fields.Str(required=True)
    ticker = fields.Str(required=True)
    quantity = fields.Float(required=True)
    pricePerUnit = fields.Float(required=True)
    stopLoss = fields.Float(required=False)  # Make it optional
    date = fields.DateTime(format="%Y-%m-%d", missing=lambda: datetime.utcnow())  # Default to current UTC time

    @validates_schema
    def validate_values(self, data, **kwargs):
        if data["quantity"] <= 0:
            raise ValidationError("Quantity must be greater than 0.")
        if data["pricePerUnit"] <= 0:
            raise ValidationError("Price per unit must be greater than 0.")
        if data["stopLoss"] < 0:
            raise ValidationError("Stop loss must be non-negative.")
        data["ticker"] = data["ticker"].upper()  # Ensure ticker is uppercase
