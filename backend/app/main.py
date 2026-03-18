from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.redis import close_redis, init_redis
from app.db.session import AsyncSessionLocal, Base, engine

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    logger.info("Skipping runtime metadata.create_all; schema is managed by Alembic migrations.")

    if settings.ENABLE_AUTH:
        from app.services.auth_service import seed_default_users
        async with AsyncSessionLocal() as db:
            await seed_default_users(db)
        logger.info("Auth enabled — default users seeded.")
    else:
        logger.info("Auth disabled — running in pure-tool mode (users table skipped).")

    await init_redis()
    yield
    # Shutdown
    await close_redis()
    await engine.dispose()


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="GS1 UDI generation service for medical devices/pharma use-cases.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_application()

