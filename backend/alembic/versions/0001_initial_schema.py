"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-14 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="operator"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "label_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("gtin", sa.String(14), nullable=False),
        sa.Column("batch_no", sa.String(100), nullable=True),
        sa.Column("expiry_date", sa.String(8), nullable=True),
        sa.Column("serial_no", sa.String(100), nullable=True),
        sa.Column("production_date", sa.String(8), nullable=True),
        sa.Column("remarks", sa.Text, nullable=True),
        sa.Column("full_string", sa.Text, nullable=False),
        sa.Column("hri", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_label_history_id", "label_history", ["id"])
    op.create_index("ix_label_history_user_id", "label_history", ["user_id"])
    op.create_index("ix_label_history_gtin", "label_history", ["gtin"])
    op.create_index("ix_label_history_batch_no", "label_history", ["batch_no"])
    op.create_index("ix_label_history_created_at", "label_history", ["created_at"])
    # Composite indexes for efficient paginated history queries
    op.create_index("ix_lh_user_created", "label_history", ["user_id", "created_at"])
    op.create_index("ix_lh_user_id_desc", "label_history", ["user_id", "id"])


def downgrade() -> None:
    op.drop_table("label_history")
    op.drop_table("users")
