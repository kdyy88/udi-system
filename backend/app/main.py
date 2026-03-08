from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.session import Base, SessionLocal, engine, prepare_sqlite_schema_for_poc
from app.services.auth_service import seed_default_users


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="GS1 UDI generation service for medical devices/pharma use-cases.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.on_event("startup")
    def on_startup() -> None:
        prepare_sqlite_schema_for_poc()
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            seed_default_users(db)

    return app


app = create_application()
