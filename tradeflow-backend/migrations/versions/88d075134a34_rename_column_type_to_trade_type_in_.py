"""Rename column 'type' to 'trade_type' in trades table

Revision ID: 88d075134a34
Revises: 123456789abc
Create Date: 2025-03-07 17:16:57.708713

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "88d075134a34"
down_revision = "123456789abc"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "trades",
        "type",
        new_column_name="trade_type",
        existing_type=sa.String(length=20),
    )


def downgrade():
    op.alter_column(
        "trades",
        "trade_type",
        new_column_name="type",
        existing_type=sa.String(length=20),
    )
