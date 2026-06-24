"""
Attachments API router.
Nested under /work-items/{work_item_id}/attachments.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.attachment import AttachmentResponse
from app.schemas.work_item import UserBrief
from app.services.attachment_service import AttachmentService

router = APIRouter()


def _to_response(attachment) -> AttachmentResponse:
    """Convert Attachment model to response schema."""
    return AttachmentResponse(
        id=attachment.id,
        work_item_id=attachment.work_item_id,
        uploaded_by=UserBrief(id=attachment.uploaded_by.id, login=attachment.uploaded_by.login, email=attachment.uploaded_by.email) if attachment.uploaded_by else None,
        filename=attachment.filename,
        content_type=attachment.content_type,
        file_size=attachment.file_size,
        created_at=attachment.created_at,
    )


@router.get("", response_model=List[AttachmentResponse])
def list_attachments(
    work_item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all attachments for a work item."""
    attachments = AttachmentService.list_for_work_item(db, current_user, work_item_id)
    return [_to_response(a) for a in attachments]


@router.post("", response_model=AttachmentResponse, status_code=201)
def upload_attachment(
    work_item_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file attachment for a work item."""
    attachment = AttachmentService.upload(db, current_user, work_item_id, file)
    return _to_response(attachment)


@router.get("/{attachment_id}")
def download_attachment(
    work_item_id: UUID,
    attachment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download the actual attached file."""
    attachment, file_path = AttachmentService.download(db, current_user, attachment_id)
    return FileResponse(
        path=file_path,
        filename=attachment.filename,
        media_type=attachment.content_type,
    )
