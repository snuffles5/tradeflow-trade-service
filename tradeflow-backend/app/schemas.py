# app/schemas.py
from marshmallow import Schema, fields, validates_schema, ValidationError
from datetime import date

class TradeSchema(Schema):
    type = fields.Str(required=True)
    source = fields.Str(required=True)
    transactionType = fields.Str(required=True)
    ticker = fields.Str(required=True)
    quantity = fields.Float(required=True)
    pricePerUnit = fields.Float(required=True)
    date = fields.Date(required=True)  # e.g., "2023-01-01"
    stopLoss = fields.Float(required=True)

    @validates_schema
    def validate_values(self, data, **kwargs):
        if data["quantity"] <= 0:
            raise ValidationError("Quantity must be greater than 0.")
        if data["pricePerUnit"] <= 0:
            raise ValidationError("Price per unit must be greater than 0.")
        if data["stopLoss"] < 0:
            raise ValidationError("Stop loss must be non-negative.")
        # etc...
