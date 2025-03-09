"""Create LastPriceInfo table

Revision ID: 123456789abc
Revises: a737898e748c
Create Date: 2025-03-07 16:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '123456789abc'
down_revision = 'a737898e748c'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'last_price_info',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('ticker', sa.String(length=10), nullable=False),
        sa.Column('last_fetched_price', sa.Float(), nullable=False),
        sa.Column('last_closed_price', sa.Float(), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('atr', sa.Float(), nullable=True),
        sa.Column('sma', sa.Float(), nullable=True),
        sa.Column('rsi', sa.Float(), nullable=True)
    )


def downgrade():
    op.drop_table('last_price_info')
