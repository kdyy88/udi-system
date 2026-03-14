"""add label_batch table and batch_id to label_history

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-14 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "label_batch",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("source", sa.String(20), nullable=False, server_default="form"),
        sa.Column("total_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_label_batch_id", "label_batch", ["id"])
    op.create_index("ix_label_batch_user_id", "label_batch", ["user_id"])
    op.create_index("ix_lb_user_id_desc", "label_batch", ["user_id", "id"])

    op.add_column(
        "label_history",
        sa.Column(
            "batch_id",
            sa.Integer,
            sa.ForeignKey("label_batch.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_lh_batch_id", "label_history", ["batch_id"])


def downgrade() -> None:
    op.drop_index("ix_lh_batch_id", table_name="label_history")
    op.drop_column("label_history", "batch_id")
    op.drop_index("ix_lb_user_id_desc", table_name="label_batch")
    op.drop_index("ix_label_batch_user_id", table_name="label_batch")
    op.drop_index("ix_label_batch_id", table_name="label_batch")
    op.drop_table("label_batch")
