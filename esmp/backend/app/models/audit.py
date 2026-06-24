"""
Audit log ORM model.
Immutable append-only table in the 'audit' schema.
"""

import uuid

from sqlalchemy import Column, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.models.base import Base


class AuditLog(Base):
    """
    Immutable audit log entry.
    Written synchronously within the same transaction as the mutation.
    """
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "audit"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String(100), nullable=False, index=True)  # e.g., 'work_item', 'user', 'group'
    entity_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # 'created', 'updated', 'deleted', 'status_changed', etc.
    actor_id = Column(UUID(as_uuid=True), nullable=True)  # None for system/email actions
    actor_display = Column(String(255), nullable=True)  # Denormalized actor name for display
    old_values = Column(JSONB, nullable=True)  # Previous field values (JSON)
    new_values = Column(JSONB, nullable=True)  # New field values (JSON)
    metadata_ = Column("metadata", JSONB, nullable=True)  # Extra context (IP, user-agent if available)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
