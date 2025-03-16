"""Required date column in trades table

Revision ID: 2d79dca66ca0
Revises: 39481f6b062c
Create Date: 2025-03-03 19:43:00.224641

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2d79dca66ca0"
down_revision = "39481f6b062c"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Set a default value for existing NULL values
    op.execute("UPDATE trades SET date = NOW() WHERE date IS NULL")

    # 2. Alter the column to make it NOT NULL
    op.alter_column("trades", "date", existing_type=sa.DateTime(), nullable=False)


def downgrade():
    # Reverse the change if needed
    op.alter_column("trades", "date", existing_type=sa.DateTime(), nullable=True)
