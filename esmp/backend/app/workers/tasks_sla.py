"""
Celery asynchronous background tasks for the SLA Engine.
"""

import structlog

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.services.sla_service import SlaService
from app.models.work_item import WorkItem
from app.models.sla import SlaClock

logger = structlog.get_logger()


@celery_app.task(name="app.workers.tasks_sla.sla_breach_scan")
def sla_breach_scan() -> str:
    """
    Scans active SLA clocks that have exceeded their deadline.
    Runs every 1 minute.
    """
    logger.info("Executing periodic SLA breach scan")
    db = SessionLocal()
    try:
        breached_count = SlaService.check_breaches(db)
        return f"Completed SLA breach scan. Newly breached: {breached_count}"
    except Exception as e:
        logger.error("Error in SLA breach scan task", error=str(e))
        db.rollback()
        raise e
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks_sla.sla_reconcile_deadlines")
def sla_reconcile_deadlines() -> str:
    """
    Reconciles work items' denormalized resolution_deadline from active SLA clocks.
    Runs every 5 minutes.
    """
    logger.info("Executing SLA deadline reconciliation")
    db = SessionLocal()
    try:
        # Get active work items
        active_items = db.query(WorkItem).filter(
            WorkItem.status.in_(["new", "assigned", "in_progress", "pending_user"])
        ).all()
        
        reconciled_count = 0
        for item in active_items:
            res_clock = db.query(SlaClock).filter(
                SlaClock.work_item_id == item.id,
                SlaClock.metric == "resolution"
            ).first()
            
            if res_clock and item.resolution_deadline != res_clock.deadline:
                item.resolution_deadline = res_clock.deadline
                reconciled_count += 1
                
        if reconciled_count > 0:
            db.commit()
            
        return f"Reconciled deadlines for {reconciled_count} work items"
    except Exception as e:
        logger.error("Error in SLA deadline reconciliation task", error=str(e))
        db.rollback()
        raise e
    finally:
        db.close()
