from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class LabelBatch(Base):
    __tablename__ = "label_batch"
    __table_args__ = (
        Index("ix_lb_user_id_desc", "user_id", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20), default="form")  # "excel" | "form"
    total_count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    labels: Mapped[list["LabelHistory"]] = relationship(
        "LabelHistory", back_populates="batch", passive_deletes=True
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="operator")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )


class LabelHistory(Base):
    __tablename__ = "label_history"
    __table_args__ = (
        Index("ix_lh_user_created", "user_id", "created_at"),
        Index("ix_lh_user_id_desc", "user_id", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    gtin: Mapped[str] = mapped_column(String(14), index=True)
    batch_no: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    expiry_date: Mapped[str | None] = mapped_column(String(8), nullable=True)
    serial_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    production_date: Mapped[str | None] = mapped_column(String(8), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    full_string: Mapped[str] = mapped_column(Text)
    hri: Mapped[str] = mapped_column(Text)
    batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("label_batch.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), index=True
    )

    batch: Mapped["LabelBatch | None"] = relationship("LabelBatch", back_populates="labels")

