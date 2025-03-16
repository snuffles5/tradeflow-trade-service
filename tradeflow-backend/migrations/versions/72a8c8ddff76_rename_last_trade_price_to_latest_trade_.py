"""Rename last_trade_price to latest_trade_price in unrealized_holdings

Revision ID: 72a8c8ddff76
Revises: 815f0ca8bf66
Create Date: 2025-03-10 22:12:49.587988

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "72a8c8ddff76"
down_revision = "815f0ca8bf66"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "unrealized_holdings",
        "last_trade_price",
        new_column_name="latest_trade_price",
        existing_type=sa.Float(),
        existing_nullable=False,
    )


def downgrade():
    op.alter_column(
        "unrealized_holdings",
        "latest_trade_price",
        new_column_name="last_trade_price",
        existing_type=sa.Float(),
        existing_nullable=False,
    )
