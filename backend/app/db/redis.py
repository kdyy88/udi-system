"""Async Redis connection pool.

Usage in FastAPI dependencies:
    from app.db.redis import get_redis
    redis = Annotated[Redis, Depends(get_redis)]

Rate-limiting helpers:
    await check_rate_limit(redis, email)  # raises HTTP 429 if exceeded
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import HTTPException, status
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_pool: aioredis.Redis | None = None


async def init_redis() -> None:
    global _redis_pool
    client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
    )
    try:
        await client.ping()
        _redis_pool = client
        logger.info("Redis connected: %s", settings.REDIS_URL)
    except (RedisError, OSError) as exc:
        await client.aclose()
        _redis_pool = None
        logger.warning(
            "Redis unavailable (%s: %s) — rate limiting disabled.",
            type(exc).__name__,
            exc,
        )


async def close_redis() -> None:
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None


def get_redis_client() -> aioredis.Redis | None:
    return _redis_pool


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    if _redis_pool is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Redis 不可用，请联系管理员",
        )
    yield _redis_pool

OTP_COOLDOWN_TTL = 60          # seconds
OTP_DAILY_LIMIT = 10
OTP_DAILY_TTL = 86_400         # 24 hours


async def check_and_record_send(redis: aioredis.Redis, email: str) -> None:
    from datetime import date

    cool_key = f"otp_cool:{email}"
    daily_key = f"otp_daily:{email}:{date.today().isoformat()}"

    if await redis.exists(cool_key):
        ttl = await redis.ttl(cool_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"请求过于频繁，请 {ttl} 秒后再试",
        )

    daily_count = int(await redis.get(daily_key) or 0)
    if daily_count >= OTP_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="今日发送次数已达上限，请明天再试",
        )

    pipe = redis.pipeline()
    pipe.set(cool_key, "1", ex=OTP_COOLDOWN_TTL)
    pipe.incr(daily_key)
    pipe.expire(daily_key, OTP_DAILY_TTL)
    await pipe.execute()
