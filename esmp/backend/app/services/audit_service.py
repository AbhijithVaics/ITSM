"""
Audit service: synchronous immutable audit log writer.
Called from every mutating service method within the same transaction.
"""

from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


class AuditService:
    """
    Writes immutable audit rows.
    Always called within the caller's transaction boundary so that
    audit + mutation are atomic.
    """

    @staticmethod
    def log(
        db: Session,
        *,
        entity_type: str,
        entity_id: UUID,
        action: str,
        actor_id: Optional[UUID] = None,
        actor_display: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """
        Write a single audit log entry.

        Args:
            db: Active SQLAlchemy session (caller owns transaction).
            entity_type: Type of entity being audited (e.g., 'work_item', 'user').
            entity_id: UUID of the entity.
            action: What happened (e.g., 'created', 'updated', 'status_changed').
            actor_id: UUID of the user performing the action (None for system).
            actor_display: Denormalized display name of the actor.
            old_values: JSON-serializable dict of previous values.
            new_values: JSON-serializable dict of new values.
            metadata: Extra context (IP, user-agent, etc.).
        """
        entry = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            actor_id=actor_id,
            actor_display=actor_display,
            old_values=old_values,
            new_values=new_values,
            metadata_=metadata,
        )
        db.add(entry)
        # Do NOT flush here — let the caller's transaction handle it
        return entry

    @staticmethod
    def query(
        db: Session,
        *,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
        actor_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 50,
    ):
        """
        Query audit log entries with optional filters and pagination.
        """
        query = db.query(AuditLog)

        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(AuditLog.entity_id == entity_id)
        if actor_id:
            query = query.filter(AuditLog.actor_id == actor_id)

        total = query.count()
        items = (
            query.order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total
