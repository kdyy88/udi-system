from datetime import UTC, datetime

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "gs1-udi-backend",
        "timestamp": datetime.now(UTC).isoformat(),
    }
