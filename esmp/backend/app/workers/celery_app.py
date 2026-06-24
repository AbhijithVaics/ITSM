"""
Celery worker application configuration.
Integrates Celery with the main FastAPI/SQLAlchemy application using Redis.
"""

from celery import Celery
from celery.schedules import crontab
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Configure Celery app with Redis broker and result backend
celery_app = Celery(
    "esmp_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# Optional configuration settings
celery_app.conf.update(
    timezone=settings.ORG_TIMEZONE,
    enable_utc=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Enforce import of task files
    imports=[
        "app.workers.tasks_email",
        "app.workers.tasks_graph",
        "app.workers.tasks_sla",
    ],
)

# Configure Celery Beat periodic schedules
celery_app.conf.beat_schedule = {
    "renew-graph-subscriptions-daily": {
        "task": "app.workers.tasks_graph.renew_all_subscriptions",
        "schedule": crontab(hour=1, minute=0),  # Run daily at 1:00 AM UTC
    },
    "sla-breach-scan-every-minute": {
        "task": "app.workers.tasks_sla.sla_breach_scan",
        "schedule": crontab(minute="*"),  # Run every minute
    },
    "sla-reconcile-deadlines-every-5-minutes": {
        "task": "app.workers.tasks_sla.sla_reconcile_deadlines",
        "schedule": crontab(minute="*/5"),  # Run every 5 minutes
    },
}
