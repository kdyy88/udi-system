"""decouple auth: rename user_id to owner_id (string, no FK)

Converts all three business tables from integer ``user_id`` with a FK to
``users.id`` into a plain ``owner_id VARCHAR(128)`` column.  Existing data
is preserved by casting the old integer ids to strings.

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-17 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that carry the user_id → owner_id migration
_TABLES = ("label_history", "label_batch", "label_template")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for table in _TABLES:
        existing_cols = {c["name"] for c in inspector.get_columns(table)}
        if "owner_id" in existing_cols:
            continue  # already migrated

        # 1. Add owner_id column with default
        op.add_column(
            table,
            sa.Column("owner_id", sa.String(128), nullable=False, server_default="anonymous"),
        )

        # 2. Copy existing user_id values (cast int → string)
        if "user_id" in existing_cols:
            op.execute(
                sa.text(f'UPDATE "{table}" SET owner_id = CAST(user_id AS VARCHAR)')
            )

        # 3. Create index on owner_id
        op.create_index(f"ix_{table}_owner_id", table, ["owner_id"])

    # ── Drop old user_id columns and their FK constraints / indexes ───────
    for table in _TABLES:
        existing_cols = {c["name"] for c in inspector.get_columns(table)}
        if "user_id" not in existing_cols:
            continue

        # Drop FK constraints referencing users.id
        fks = inspector.get_foreign_keys(table)
        for fk in fks:
            if "user_id" in fk["constrained_columns"]:
                fk_name = fk["name"]
                if fk_name:
                    op.drop_constraint(fk_name, table, type_="foreignkey")

        # Drop old indexes on user_id
        indexes = inspector.get_indexes(table)
        for idx in indexes:
            if "user_id" in idx["column_names"]:
                op.drop_index(idx["name"], table_name=table)

        # Drop the column itself
        op.drop_column(table, "user_id")

    # ── Create composite indexes (replacing old user_id composites) ───────
    # label_batch: (owner_id, id)
    _safe_create_index(inspector, "ix_lb_owner_id_desc", "label_batch", ["owner_id", "id"])
    # label_history: (owner_id, created_at) and (owner_id, id)
    _safe_create_index(inspector, "ix_lh_owner_created", "label_history", ["owner_id", "created_at"])
    _safe_create_index(inspector, "ix_lh_owner_id_desc", "label_history", ["owner_id", "id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Drop new composite indexes
    for idx_name in ("ix_lb_owner_id_desc", "ix_lh_owner_created", "ix_lh_owner_id_desc"):
        try:
            op.drop_index(idx_name)
        except Exception:
            pass

    for table in _TABLES:
        existing_cols = {c["name"] for c in inspector.get_columns(table)}
        if "user_id" in existing_cols:
            continue

        # Re-add user_id as nullable first
        op.add_column(
            table,
            sa.Column("user_id", sa.Integer, nullable=True),
        )

        # Copy owner_id back.
        # Records created in tool mode carry owner_id="anonymous" (or any
        # non-numeric string).  These cannot be mapped to a real User FK, so
        # we delete them before reinstating the NOT NULL + FK constraint.
        if "owner_id" in existing_cols:
            # 1. Map numeric owner_ids back to integers
            op.execute(
                sa.text(
                    f'UPDATE "{table}" SET user_id = CAST(owner_id AS INTEGER) '
                    f"WHERE owner_id ~ '^[0-9]+$'"
                )
            )
            # 2. Remove rows that cannot satisfy the FK (tool-mode data)
            op.execute(
                sa.text(f'DELETE FROM "{table}" WHERE user_id IS NULL')
            )

        # Make user_id NOT NULL
        op.alter_column(table, "user_id", nullable=False)

        # Re-create FK
        op.create_foreign_key(
            f"fk_{table}_user_id_users",
            table,
            "users",
            ["user_id"],
            ["id"],
        )
        op.create_index(f"ix_{table}_user_id", table, ["user_id"])

        # Drop owner_id
        idx_name = f"ix_{table}_owner_id"
        try:
            op.drop_index(idx_name, table_name=table)
        except Exception:
            pass
        op.drop_column(table, "owner_id")

    # Restore old composite indexes
    op.create_index("ix_lb_user_id_desc", "label_batch", ["user_id", "id"])
    op.create_index("ix_lh_user_created", "label_history", ["user_id", "created_at"])
    op.create_index("ix_lh_user_id_desc", "label_history", ["user_id", "id"])


def _safe_create_index(inspector, name: str, table: str, columns: list[str]) -> None:
    """Create index only if it doesn't already exist."""
    existing = {idx["name"] for idx in inspector.get_indexes(table)}
    if name not in existing:
        op.create_index(name, table, columns)
