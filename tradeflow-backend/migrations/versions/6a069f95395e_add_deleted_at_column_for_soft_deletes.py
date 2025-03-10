"""Add deleted_at column for soft deletes

Revision ID: 6a069f95395e
Revises: dc3ec5003c90
Create Date: 2025-03-09 22:14:21.998397

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '6a069f95395e'
down_revision = 'dc3ec5003c90'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('unrealized_holdings', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('trades', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('last_price_info', sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('unrealized_holdings', 'deleted_at')
    op.drop_column('trades', 'deleted_at')
    op.drop_column('last_price_info', 'deleted_at')
