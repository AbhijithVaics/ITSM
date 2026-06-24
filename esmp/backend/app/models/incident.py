"""
Incident extension model.
Stores incident-specific fields that don't belong on the work_items spine.
"""

import uuid

from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class IncidentExtension(Base):
    """
    Incident-specific fields.
    1:1 relationship with work_items where work_item_type='incident'.
    """
    __tablename__ = "incident_extensions"
    __table_args__ = {"schema": "incident"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("work_item.work_items.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Priority matrix fields
    urgency = Column(Integer, nullable=True)   # 1=High, 2=Medium, 3=Low
    impact = Column(Integer, nullable=True)    # 1=High, 2=Medium, 3=Low

    # Classification
    category = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)

    # Resolution
    resolution_code = Column(String(50), nullable=True)
    resolution_note = Column(Text, nullable=True)

    # Relationship back to work_item
    work_item = relationship("WorkItem", back_populates="incident_extension")
