"""
ESMP FastAPI application factory.
Mounts routers, middleware, exception handlers, and CORS.
"""

import structlog
import sqlalchemy as sa
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import register_exception_handlers
from app.core.middleware import RequestIdMiddleware, TimingMiddleware
from app.core.rate_limiter import RateLimitMiddleware


def configure_structlog():
    """Configure structlog for JSON logging."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if not settings.is_production else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(0),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI app."""

    configure_structlog()

    app = FastAPI(
        title="ESMP Backend API",
        description="Enterprise Service Management Platform — Gen-1 Production MVP",
        version="1.0.0",
        docs_url="/api/v1/docs" if not settings.is_production else None,
        redoc_url="/api/v1/redoc" if not settings.is_production else None,
        openapi_url="/api/v1/openapi.json" if not settings.is_production else None,
    )

    # ── Middleware (order matters: outermost first) ──
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(TimingMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Security headers middleware
    @app.middleware("http")
    async def add_security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # ── Exception handlers ──
    register_exception_handlers(app)

    # ── API routers ──
    app.include_router(api_v1_router, prefix="/api/v1")

    # ── Health check ──
    @app.get("/api/health", tags=["Health"])
    def health(db=Depends(get_db)):
        db_status = "ok"
        try:
            db.execute(sa.text("SELECT 1"))
        except Exception as e:
            db_status = f"error: {str(e)}"

        redis_status = "ok"
        try:
            from app.core.rate_limiter import redis_client
            if redis_client:
                redis_client.ping()
            else:
                redis_status = "error: client not initialized"
        except Exception as e:
            redis_status = f"error: {str(e)}"

        status_code = 200
        if db_status != "ok" or redis_status != "ok":
            status_code = 500

        return JSONResponse(
            status_code=status_code,
            content={
                "status": "ok" if status_code == 200 else "error",
                "environment": settings.ENV,
                "services": {
                    "database": db_status,
                    "redis": redis_status
                }
            }
        )

    return app


# Module-level app instance for uvicorn
app = create_app()
