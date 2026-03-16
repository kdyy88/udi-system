"""add email / is_active / is_verified / is_superuser to users

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-16 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add new columns (nullable first so existing rows are valid) ─────
    op.add_column("users", sa.Column("email", sa.String(320), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default="false"))

    # ── 2. Seed placeholder emails for existing accounts ──────────────────
    op.execute(
        "UPDATE users SET email = username || '@system.local' WHERE email IS NULL"
    )
    # Pre-existing accounts predate the verification system — treat them all as verified.
    op.execute("UPDATE users SET is_verified = true")

    # ── 3. Make email NOT NULL and add UNIQUE index ───────────────────────
    op.alter_column("users", "email", nullable=False)
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "is_superuser")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "is_active")
    op.drop_column("users", "email")
