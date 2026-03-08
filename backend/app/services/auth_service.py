import hashlib
import hmac

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User


DEFAULT_USERS = (
    {"username": "demo", "password": "demo123", "role": "operator"},
    {"username": "admin", "password": "admin123456", "role": "admin"},
)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_password(password: str, hashed_password: str) -> bool:
    if hashed_password.startswith("poc::"):
        legacy = hashed_password.removeprefix("poc::")
        return hmac.compare_digest(password, legacy)
    return hmac.compare_digest(hash_password(password), hashed_password)


def seed_default_users(db: Session) -> None:
    for item in DEFAULT_USERS:
        exists = db.execute(
            select(User).where(User.username == item["username"])
        ).scalar_one_or_none()
        if exists is None:
            db.add(
                User(
                    username=item["username"],
                    hashed_password=hash_password(item["password"]),
                    role=item["role"],
                )
            )
    db.commit()
