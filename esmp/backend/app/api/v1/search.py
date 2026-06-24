"""
Search API endpoints.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.work_item import WorkItemListResponse
from app.services.search_service import SearchService
from app.api.v1.work_items import _to_response

router = APIRouter()


@router.get("", response_model=WorkItemListResponse)
def search_tickets(
    q: str = Query(..., description="Search query string"),
    limit: int = Query(default=50, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search work items by display ID, title, or reporter email.
    """
    items, next_cursor = SearchService.search_work_items(
        db, current_user, q=q, limit=limit, cursor=cursor
    )
    return WorkItemListResponse(
        items=[_to_response(item, current_user) for item in items],
        next_cursor=next_cursor,
    )
