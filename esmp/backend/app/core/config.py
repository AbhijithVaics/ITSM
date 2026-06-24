"""
Application configuration loaded from environment variables.
All ESMP env vars use the `ESMP_` prefix.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Typed application settings.
    Reads from environment variables with ESMP_ prefix.
    Example: ESMP_DATABASE_URL, ESMP_JWT_SECRET, etc.
    """

    # ── Database ──
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/vaics_itsm"

    # ── JWT ──
    JWT_SECRET: str = "vaics-dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Redis / Celery ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Microsoft Graph ──
    GRAPH_TENANT_ID: str = ""
    GRAPH_CLIENT_ID: str = ""
    GRAPH_CLIENT_SECRET: str = ""
    GRAPH_MAILBOX: str = ""
    GRAPH_WEBHOOK_URL: str = ""
    GRAPH_WEBHOOK_SECRET: str = ""

    # ── File storage ──
    ATTACHMENT_PATH: str = "./attachments"
    ATTACHMENT_MAX_SIZE_MB: int = 25

    # ── Organization ──
    ORG_TIMEZONE: str = "Asia/Kolkata"

    # ── CORS ──
    CORS_ORIGINS: str = "http://localhost:5173"

    # ── Environment ──
    ENV: str = "local"  # local | dev | staging | production

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    class Config:
        env_prefix = "ESMP_"
        case_sensitive = True
        env_file = ".env"


settings = Settings()
