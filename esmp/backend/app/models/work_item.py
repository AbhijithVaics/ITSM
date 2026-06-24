"""
Work Item core model and display ID sequence.
Central table using the work_items spine pattern (Option A from the architecture review).
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class WorkItem(TimestampMixin, SoftDeleteMixin, Base):
    """
    Core work item table — shared spine for incidents and changes.
    Extension-specific fields live in incident_extensions / change_extensions.
    """
    __tablename__ = "work_items"
    __table_args__ = (
        Index("ix_wi_assigned_group_status_deadline", "assigned_group_id", "status", "resolution_deadline"),
        Index("ix_wi_type_status", "work_item_type", "status"),
        Index("ix_wi_reported_by_created", "reported_by_id", "created_at"),
        {"schema": "work_item"},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_id = Column(String(30), unique=True, nullable=False, index=True)
    work_item_type = Column(String(20), nullable=False, index=True)  # 'incident' | 'change'

    # Core fields
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True, default="")
    status = Column(String(50), nullable=False, index=True)
    priority = Column(String(10), nullable=True)  # P1-P4 for incidents

    # Assignment
    reported_by_id = Column(UUID(as_uuid=True), ForeignKey("identity.users.id"), nullable=True, index=True)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("identity.users.id"), nullable=True, index=True)
    assigned_group_id = Column(UUID(as_uuid=True), ForeignKey("identity.groups.id"), nullable=True, index=True)

    # Source
    source = Column(String(20), nullable=False, default="portal")  # portal | email | agent

    # SLA milestones (denormalized for query performance)
    resolution_deadline = Column(DateTime(timezone=True), nullable=True)
    first_response_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    reported_by = relationship("User", foreign_keys=[reported_by_id], lazy="joined")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="joined")
    assigned_group = relationship("Group", foreign_keys=[assigned_group_id], lazy="joined")
    incident_extension = relationship("IncidentExtension", back_populates="work_item", uselist=False, lazy="joined")
    change_extension = relationship("ChangeExtension", back_populates="work_item", uselist=False, lazy="joined")
    comments = relationship("Comment", back_populates="work_item", lazy="dynamic", order_by="Comment.created_at")
    attachments = relationship("Attachment", back_populates="work_item", lazy="dynamic")
    sla_clocks = relationship("SlaClock", back_populates="work_item", lazy="joined")


class DisplayIdSequence(Base):
    """
    Sequence counter for generating unique display IDs.
    One row per (prefix, date) combination.
    Example: prefix='INC', date_part='20260624', next_seq=5 → INC-20260624-0005
    """
    __tablename__ = "display_id_sequences"
    __table_args__ = {"schema": "work_item"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prefix = Column(String(10), nullable=False)
    date_part = Column(String(8), nullable=False)  # YYYYMMDD
    next_seq = Column(Integer, nullable=False, default=1)

    __table_args__ = (
        Index("uq_display_id_seq", "prefix", "date_part", unique=True),
        {"schema": "work_item"},
    )
