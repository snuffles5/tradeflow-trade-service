"""Update unrealized_holdings: remove holding_period_days and add open_date and close_date

Revision ID: 815f0ca8bf66
Revises: 281dbe90bbb5
Create Date: 2025-03-10 21:58:26.986534

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import Inspector

# revision identifiers, used by Alembic.
revision = "815f0ca8bf66"
down_revision = "281dbe90bbb5"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn.engine)
    columns = [col["name"] for col in inspector.get_columns("unrealized_holdings")]

    # 1. Add open_date if it does not exist.
    if "open_date" not in columns:
        op.add_column(
            "unrealized_holdings",
            sa.Column(
                "open_date",
                sa.DateTime(),
                nullable=True,
                server_default=sa.text("NOW()"),
            ),
        )
    # 2. Add close_date if it does not exist.
    if "close_date" not in columns:
        op.add_column(
            "unrealized_holdings", sa.Column("close_date", sa.DateTime(), nullable=True)
        )
    # 3. Populate open_date from entry_date for existing rows.
    if "entry_date" in columns:
        op.execute(
            "UPDATE unrealized_holdings SET open_date = entry_date WHERE open_date IS NULL"
        )
    # 4. Alter open_date to be non-nullable (specifying existing_type explicitly).
    with op.batch_alter_table("unrealized_holdings") as batch_op:
        batch_op.alter_column("open_date", nullable=False, existing_type=sa.DateTime())
    # 5. Drop the obsolete holding_period_days column if it exists.
    if "holding_period_days" in columns:
        op.drop_column("unrealized_holdings", "holding_period_days")
    # 6. Drop entry_date if it exists.
    if "entry_date" in columns:
        op.drop_column("unrealized_holdings", "entry_date")


def downgrade():
    # 1. Re-add the entry_date column with a default (using NOW()).
    op.add_column(
        "unrealized_holdings",
        sa.Column(
            "entry_date", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")
        ),
    )
    with op.batch_alter_table("unrealized_holdings") as batch_op:
        batch_op.alter_column(
            "entry_date", server_default=None, existing_type=sa.DateTime()
        )
    # 2. Re-add holding_period_days column.
    op.add_column(
        "unrealized_holdings",
        sa.Column("holding_period_days", sa.Integer(), nullable=True),
    )
    # 3. Drop the new columns open_date and close_date.
    op.drop_column("unrealized_holdings", "close_date")
    op.drop_column("unrealized_holdings", "open_date")
