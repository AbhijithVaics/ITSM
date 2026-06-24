"""
Cross-cutting middleware: request ID injection and request timing.
"""

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
import structlog


logger = structlog.get_logger()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """
    Injects a unique X-Request-ID header into every request/response.
    Used for log correlation across the entire request lifecycle.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        # Store on request state for access in handlers
        request.state.request_id = request_id

        # Bind to structlog context for the duration of this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """
    Logs request duration for performance monitoring.
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            "request_completed",
            method=request.method,
            path=str(request.url.path),
            status_code=response.status_code,
            duration_ms=round(duration_ms, 2),
        )

        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        return response
