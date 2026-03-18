"""add composite index for label_template owner pagination

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-17 00:30:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {idx["name"] for idx in inspector.get_indexes("label_template")}
    if "ix_lt_owner_id_desc" not in existing:
        op.create_index("ix_lt_owner_id_desc", "label_template", ["owner_id", "id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {idx["name"] for idx in inspector.get_indexes("label_template")}
    if "ix_lt_owner_id_desc" in existing:
        op.drop_index("ix_lt_owner_id_desc", table_name="label_template")