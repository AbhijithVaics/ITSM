"""
Redis-backed sliding window rate limiting middleware.
"""

import time
import redis
import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.config import settings

logger = structlog.get_logger()

try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error("Failed to connect to Redis for rate limiting", error=str(e))
    redis_client = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Lightweight Redis-backed rate limiter middleware.
    Restricts request rates dynamically per IP.
    """

    async def dispatch(self, request: Request, call_next):
        # Fail-open if Redis is not connected
        if redis_client is None:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path

        # Exclude docs, redoc, health checks, etc.
        if (
            path.startswith("/api/v1/docs")
            or path.startswith("/api/v1/redoc")
            or path.startswith("/api/v1/openapi.json")
            or path.startswith("/api/health")
        ):
            return await call_next(request)

        # Enforce rate rules
        if path.startswith("/api/v1/auth/login"):
            # Max 5 login attempts per minute per IP to prevent brute-forcing
            limit = 5
            window = 60
            key = f"rate_limit:login:{client_ip}"
        elif path.startswith("/api/v1/"):
            # General API routes: 100 requests per minute
            limit = 100
            window = 60
            key = f"rate_limit:api:{client_ip}"
        else:
            return await call_next(request)

        try:
            current_time = time.time()
            pipe = redis_client.pipeline()
            # Clear old timestamps outside the window
            pipe.zremrangebyscore(key, 0, current_time - window)
            # Add current timestamp
            pipe.zadd(key, {str(current_time): current_time})
            # Count elements in window
            pipe.zcard(key)
            # Set TTL on set
            pipe.expire(key, window)
            
            # Execute pipeline
            _, _, request_count, _ = pipe.execute()

            if request_count > limit:
                logger.warn("Rate limit exceeded", client_ip=client_ip, path=path, count=request_count, limit=limit)
                return Response(
                    content="Rate limit exceeded. Please try again later.",
                    status_code=429,
                    media_type="text/plain"
                )
        except Exception as e:
            # Fail-open: log error but do not block request
            logger.error("Rate limiter execution error, failing open", error=str(e))

        return await call_next(request)
