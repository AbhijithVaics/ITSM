"""
Common/shared Pydantic schemas: pagination, problem detail, etc.
"""

from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Cursor-based paginated response."""
    items: List[T]
    next_cursor: Optional[str] = None
    total: Optional[int] = None


class OffsetPaginatedResponse(BaseModel, Generic[T]):
    """Offset-based paginated response."""
    items: List[T]
    total: int
    page: int
    page_size: int


class ProblemDetail(BaseModel):
    """RFC 7807 Problem Details response."""
    type: str
    title: str
    status: int
    detail: str
    instance: Optional[str] = None
