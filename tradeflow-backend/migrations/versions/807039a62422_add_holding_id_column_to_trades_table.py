"""Add holding_id column to trades table

Revision ID: 807039a62422
Revises: 2d79dca66ca0
Create Date: 2025-03-06 22:29:56.738230

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "807039a62422"
down_revision = "2d79dca66ca0"
branch_labels = None
depends_on = None


def upgrade():
    # 1) Add the new column holding_id (nullable)
    op.add_column("trades", sa.Column("holding_id", sa.Integer(), nullable=True))


def downgrade():
    # Reverse the changes if needed
    op.drop_constraint("fk_trades_holding_id", "trades", type_="foreignkey")
    op.drop_column("trades", "holding_id")
