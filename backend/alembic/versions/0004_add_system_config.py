"""add system_config table

Revision ID: 0004
Revises: 0003
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_system_config_id"), "system_config", ["id"], unique=False)
    op.create_index(op.f("ix_system_config_key"), "system_config", ["key"], unique=True)

    # Seed the hidden_system_templates row so GET never fails
    op.execute(
        "INSERT INTO system_config (key, value) VALUES ('hidden_system_templates', '[]'::jsonb)"
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_system_config_key"), table_name="system_config")
    op.drop_index(op.f("ix_system_config_id"), table_name="system_config")
    op.drop_table("system_config")
