"""Rename date column to trade_date in trades table

Revision ID: cb25511c2eeb
Revises: 88d075134a34
Create Date: 2025-03-07 21:03:04.272959

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "cb25511c2eeb"
down_revision = "88d075134a34"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "trades", "date", new_column_name="trade_date", existing_type=sa.DateTime()
    )


def downgrade():
    op.alter_column(
        "trades", "trade_date", new_column_name="date", existing_type=sa.DateTime()
    )
