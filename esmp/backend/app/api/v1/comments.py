"""
Comments API router.
Nested under /work-items/{work_item_id}/comments.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.work_item import UserBrief
from app.services.comment_service import CommentService

router = APIRouter()


def _to_response(comment) -> CommentResponse:
    """Convert Comment model to response schema."""
    return CommentResponse(
        id=comment.id,
        work_item_id=comment.work_item_id,
        author=UserBrief(id=comment.author.id, login=comment.author.login, email=comment.author.email) if comment.author else None,
        text=comment.text,
        visibility=comment.visibility,
        created_at=comment.created_at,
    )


@router.get("", response_model=List[CommentResponse])
def list_comments(
    work_item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all comments for a work item (subject to role visibility checks)."""
    comments = CommentService.list_for_work_item(db, current_user, work_item_id)
    return [_to_response(c) for c in comments]


@router.post("", response_model=CommentResponse, status_code=201)
def create_comment(
    work_item_id: UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new comment on a work item (public or internal)."""
    comment = CommentService.add_comment(
        db,
        current_user,
        work_item_id,
        text=payload.text,
        visibility=payload.visibility,
    )
    return _to_response(comment)
