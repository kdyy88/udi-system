"""add label_template table

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-14 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if "label_template" not in existing_tables:
        op.create_table(
            "label_template",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(120), nullable=False),
            sa.Column("description", sa.Text, nullable=True),
            sa.Column("canvas_width_px", sa.Numeric(8, 2), nullable=False, server_default="378"),
            sa.Column("canvas_height_px", sa.Numeric(8, 2), nullable=False, server_default="227"),
            sa.Column("canvas_json", sa.JSON, nullable=False, server_default="[]"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
        )
        op.create_index("ix_label_template_id", "label_template", ["id"])
        op.create_index("ix_label_template_user_id", "label_template", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_label_template_user_id", table_name="label_template")
    op.drop_index("ix_label_template_id", table_name="label_template")
    op.drop_table("label_template")
