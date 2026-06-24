"""
Celery asynchronous tasks for Microsoft Graph subscription management.
"""

import datetime
import structlog
from sqlalchemy.orm import Session

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.email import GraphSubscription
from app.services.email.graph_client import graph_client

logger = structlog.get_logger()


@celery_app.task(name="app.workers.tasks_graph.renew_all_subscriptions")
def renew_all_subscriptions() -> str:
    """
    Periodic task to renew all active Graph subscriptions before they expire.
    Queries subscriptions expiring in the next 24 hours and triggers renewal.
    """
    logger.info("Starting periodic Graph subscription renewal check")
    db = SessionLocal()
    renewed_count = 0
    failed_count = 0

    try:
        # Renew any subscription expiring in the next 24 hours
        threshold = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
        expiring_subs = (
            db.query(GraphSubscription)
            .filter(GraphSubscription.expires_at <= threshold)
            .all()
        )

        for sub in expiring_subs:
            try:
                logger.info("Renewing Graph subscription", subscription_id=sub.subscription_id, mailbox=sub.mailbox)
                result = graph_client.renew_subscription(sub.subscription_id)
                
                # Update expires_at in db
                exp_date_str = result.get("expirationDateTime")
                if exp_date_str:
                    # Parse ISO timestamp (e.g. "2026-06-26T11:43:54.582Z")
                    # Replace Z with UTC offset
                    clean_str = exp_date_str.replace("Z", "+00:00")
                    sub.expires_at = datetime.datetime.fromisoformat(clean_str)
                    db.add(sub)
                    renewed_count += 1
                else:
                    logger.error("Graph response missing expirationDateTime", sub_id=sub.subscription_id)
                    failed_count += 1

            except Exception as ex:
                logger.error(
                    "Failed to renew Graph subscription",
                    subscription_id=sub.subscription_id,
                    error=str(ex)
                )
                failed_count += 1

        if renewed_count > 0 or failed_count > 0:
            db.commit()
            
        return f"Subscription renewal check finished. Renewed: {renewed_count}, Failed: {failed_count}."
        
    except Exception as e:
        logger.error("Error running renew_all_subscriptions task", error=str(e))
        db.rollback()
        raise e
    finally:
        db.close()
