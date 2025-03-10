"""update last_trade_price column

Revision ID: 281dbe90bbb5
Revises: 6a069f95395e
Create Date: 2025-03-10 21:38:34.429930

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '281dbe90bbb5'
down_revision = '6a069f95395e'
branch_labels = None
depends_on = None


def upgrade():
    # Alter columns on trades.
    op.alter_column('trades', 'trade_type',
                    existing_type=mysql.VARCHAR(length=20),
                    type_=sa.String(length=50),
                    existing_nullable=True)
    op.alter_column('trades', 'source',
                    existing_type=mysql.VARCHAR(length=50),
                    type_=sa.String(length=100),
                    nullable=True)
    op.alter_column('trades', 'transaction_type',
                    existing_type=mysql.VARCHAR(length=10),
                    nullable=True)
    op.alter_column('trades', 'ticker',
                    existing_type=mysql.VARCHAR(length=20),
                    type_=sa.String(length=10),
                    existing_nullable=False)

    # Fix any trades rows that reference non-existent holdings.
    op.execute("""
        UPDATE trades
        SET holding_id = NULL
        WHERE holding_id IS NOT NULL
          AND holding_id NOT IN (SELECT id FROM unrealized_holdings)
    """)

    # Create the foreign key constraint.
    op.create_foreign_key(None, 'trades', 'unrealized_holdings', ['holding_id'], ['id'])

    # Add the new column to unrealized_holdings.
    op.add_column('unrealized_holdings', sa.Column('latest_trade_price', sa.Float(), nullable=False))
    # Drop the old column.
    op.drop_column('unrealized_holdings', 'last_trade_price')


def downgrade():
    # Re-add the dropped column.
    op.add_column('unrealized_holdings', sa.Column('last_trade_price', mysql.FLOAT(), nullable=False))
    # Drop the new column.
    op.drop_column('unrealized_holdings', 'latest_trade_price')

    # Drop the foreign key constraint.
    op.drop_constraint(None, 'trades', type_='foreignkey')

    # Revert the trades column alterations.
    op.alter_column('trades', 'ticker',
                    existing_type=sa.String(length=10),
                    type_=mysql.VARCHAR(length=20),
                    existing_nullable=False)
    op.alter_column('trades', 'transaction_type',
                    existing_type=mysql.VARCHAR(length=10),
                    nullable=False)
    op.alter_column('trades', 'source',
                    existing_type=sa.String(length=100),
                    type_=mysql.VARCHAR(length=50),
                    nullable=False)
    op.alter_column('trades', 'trade_type',
                    existing_type=sa.String(length=50),
                    type_=mysql.VARCHAR(length=20),
                    existing_nullable=True)

    # Recreate the foreign key constraint.
    op.create_foreign_key(None, 'trades', 'unrealized_holdings', ['holding_id'], ['id'])
