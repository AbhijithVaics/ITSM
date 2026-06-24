"""
Attachment ORM model.
Files uploaded and linked to work items. Bounded namespace under the 'work_item' schema.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class Attachment(Base):
    """
    Attachment associated with a work item.
    Files are stored on local disk (or object storage), and metadata is stored here.
    """
    __tablename__ = "attachments"
    __table_args__ = {"schema": "work_item"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_item_id = Column(UUID(as_uuid=True), ForeignKey("work_item.work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=False)  # size in bytes
    file_path = Column(String(500), nullable=False)  # local storage path
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    work_item = relationship("WorkItem", back_populates="attachments")
    uploaded_by = relationship("User", lazy="joined")
