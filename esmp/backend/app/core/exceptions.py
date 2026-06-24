"""
Application exception hierarchy and RFC 7807 Problem Details mapping.
"""

from typing import Any, Dict, Optional

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application error following RFC 7807 Problem Details."""

    def __init__(
        self,
        status_code: int = 500,
        error_type: str = "internal-error",
        title: str = "Internal Server Error",
        detail: str = "An unexpected error occurred",
        instance: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.error_type = error_type
        self.title = title
        self.detail = detail
        self.instance = instance
        self.extra = extra or {}
        super().__init__(self.detail)

    def to_problem_detail(self) -> dict:
        body = {
            "type": f"https://esmp.local/errors/{self.error_type}",
            "title": self.title,
            "status": self.status_code,
            "detail": self.detail,
        }
        if self.instance:
            body["instance"] = self.instance
        body.update(self.extra)
        return body


class NotFoundError(AppError):
    """Entity not found (or not visible to the current user)."""

    def __init__(self, entity: str = "Resource", entity_id: str = "", detail: str = ""):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_type="not-found",
            title="Not Found",
            detail=detail or f"{entity} '{entity_id}' not found",
        )


class ForbiddenError(AppError):
    """RBAC or scope denial."""

    def __init__(self, detail: str = "You do not have permission to perform this action"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            error_type="forbidden",
            title="Forbidden",
            detail=detail,
        )


class ValidationError(AppError):
    """Business logic validation failures (e.g., invalid workflow transition)."""

    def __init__(self, detail: str = "Validation failed", extra: Optional[Dict[str, Any]] = None):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            error_type="validation-error",
            title="Unprocessable Entity",
            detail=detail,
            extra=extra,
        )


class ConflictError(AppError):
    """Resource conflict (e.g., duplicate, concurrency issue)."""

    def __init__(self, detail: str = "Resource conflict"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_type="conflict",
            title="Conflict",
            detail=detail,
        )


class UnauthorizedError(AppError):
    """Authentication failures."""

    def __init__(self, detail: str = "Invalid credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_type="unauthorized",
            title="Unauthorized",
            detail=detail,
        )


class RateLimitError(AppError):
    """Rate limit exceeded."""

    def __init__(self, detail: str = "Rate limit exceeded. Please try again later."):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_type="rate-limited",
            title="Too Many Requests",
            detail=detail,
        )


# ── FastAPI exception handlers ──

def register_exception_handlers(app: FastAPI):
    """Register global exception handlers on the FastAPI app."""

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_problem_detail(),
            media_type="application/problem+json",
        )

    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        # In production, never expose stack traces
        import structlog
        logger = structlog.get_logger()
        logger.error("unhandled_exception", error=str(exc), path=str(request.url))

        return JSONResponse(
            status_code=500,
            content={
                "type": "https://esmp.local/errors/internal-error",
                "title": "Internal Server Error",
                "status": 500,
                "detail": "An unexpected error occurred",
            },
            media_type="application/problem+json",
        )
