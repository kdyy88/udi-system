#!/bin/bash
set -e

echo "[entrypoint] Running database migrations..."
alembic upgrade head

echo "[entrypoint] Starting Gunicorn with ${WORKERS:-4} uvicorn workers..."
exec gunicorn main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers "${WORKERS:-4}" \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --graceful-timeout 30 \
    --access-logfile - \
    --error-logfile -
