"""
Comment ORM model.
Collaboration comments on work items. Bounded namespace under the 'work_item' schema.
"""

import uuid
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base


class Comment(Base):
    """
    Comment on a work item.
    Supports public (visible to requesters) and internal (agent-only) visibility.
    """
    __tablename__ = "comments"
    __table_args__ = {"schema": "work_item"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_item_id = Column(UUID(as_uuid=True), ForeignKey("work_item.work_items.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("identity.users.id", ondelete="SET NULL"), nullable=True, index=True)
    text = Column(Text, nullable=False)
    visibility = Column(String(20), nullable=False, default="public")  # 'public' | 'internal'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    work_item = relationship("WorkItem", back_populates="comments")
    author = relationship("User", lazy="joined")
