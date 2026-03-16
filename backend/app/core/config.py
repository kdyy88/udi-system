import os
from dataclasses import dataclass, field
from pathlib import Path

# Auto-load .env from the project root (one level above backend/).
# This lets `uv run uvicorn ...` pick up secrets in dev without manually
# exporting every variable.  docker-compose passes env vars directly, so
# the file just won't be found there and this is a no-op.
try:
    from dotenv import load_dotenv
    _env_file = Path(__file__).resolve().parents[3] / ".env"
    load_dotenv(_env_file, override=False)  # override=False: shell exports win
except ModuleNotFoundError:
    pass  # python-dotenv not installed — fall back to os.environ only


@dataclass(frozen=True)
class Settings:
    PROJECT_NAME: str = "GS1 UDI System API"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://gs1user:gs1pass@postgres:5432/gs1udi",
    )
    CORS_ORIGINS: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        )
    )
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    # JWT (used by fastapi-users JWTStrategy)
    JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
    JWT_LIFETIME_SECONDS: int = int(os.getenv("JWT_LIFETIME_SECONDS", str(60 * 60 * 24 * 7)))  # 7 days
    # Email (Resend)
    # Set RESEND_API_KEY to your real key from https://resend.com/api-keys
    # Leave empty to run in dev mode (links are printed to stdout instead).
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    # 'onboarding@resend.dev' works for testing without domain verification.
    # Switch to 'noreply@yourdomain.com' once your domain is verified in Resend.
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    # Frontend base URL — used to build deep-link URLs in emails
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    # Set to "true" in production (behind HTTPS) so the cookie is Secure
    COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"


settings = Settings()
