from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def prepare_sqlite_schema_for_poc() -> None:
    """Reset outdated SQLite tables for local POC when model columns changed."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    required_columns = {
        "id",
        "user_id",
        "gtin",
        "batch_no",
        "expiry_date",
        "serial_no",
        "full_string",
        "created_at",
    }

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='label_history'")
        ).scalar_one_or_none()
        if existing is None:
            return

        rows = conn.execute(text("PRAGMA table_info(label_history)")).mappings().all()
        current_columns = {row["name"] for row in rows}

        if not required_columns.issubset(current_columns):
            conn.execute(text("DROP TABLE label_history"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
