from fastapi import APIRouter

from app.core.config import settings
from app.api.batches import router as batches_router
from app.api.labels import router as labels_router
from app.api.system import router as system_router
from app.api.templates import router as templates_router
from app.api.v1.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["system"])

# Auth and admin routes are only registered when authentication is enabled.
if settings.ENABLE_AUTH:
    from app.api.auth import router as auth_router
    from app.api.admin import router as admin_router
    api_router.include_router(auth_router)          # auth already carries its own tags
    api_router.include_router(admin_router)

api_router.include_router(labels_router, tags=["labels"])
api_router.include_router(batches_router, tags=["batches"])
api_router.include_router(templates_router, tags=["templates"])
api_router.include_router(system_router, tags=["system-config"])
