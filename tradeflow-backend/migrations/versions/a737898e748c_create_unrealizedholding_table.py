"""Create UnrealizedHolding table

Revision ID: a737898e748c
Revises: 807039a62422
Create Date: 2025-03-07 16:06:29.163120

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "a737898e748c"
down_revision = "807039a62422"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "unrealized_holdings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker", sa.String(length=10), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("trade_type", sa.String(length=50), nullable=True),
        sa.Column("total_holding", sa.Float(), nullable=False),
        sa.Column("average_cost", sa.Float(), nullable=False),
        sa.Column("stop_loss", sa.Float(), nullable=True),
        sa.Column(
            "entry_date", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade():
    op.drop_table("unrealized_holdings")
