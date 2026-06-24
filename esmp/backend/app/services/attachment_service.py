"""
Attachment service: manage uploads, downloads, and disk storage for work item attachments.
"""

import os
import uuid
from typing import Tuple
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.models.attachment import Attachment
from app.models.identity import User
from app.services.audit_service import AuditService
from app.services.work_item_service import WorkItemService


class AttachmentService:
    """
    Service layer for file attachments.
    Saves files to the configured storage path on local disk, caps size at 25MB,
    and enforces scope checks on download/upload.
    """

    @staticmethod
    def list_for_work_item(db: Session, actor: User, work_item_id: UUID) -> list[Attachment]:
        """
        List all attachments for a work item.
        Requires the actor to have access to the work item.
        """
        # Load and verify scoped access to work item
        WorkItemService.get_scoped(db, actor, work_item_id)
        return db.query(Attachment).filter(Attachment.work_item_id == work_item_id).order_by(Attachment.created_at.asc()).all()

    @staticmethod
    def upload(db: Session, actor: User, work_item_id: UUID, upload_file: UploadFile) -> Attachment:
        """
        Upload an attachment and link it to a work item.
        Validates work item access, caps file size at 25MB, saves to disk,
        and records metadata in the database.
        """
        # Load and verify scoped access to work item (forces permission check)
        WorkItemService.get_scoped(db, actor, work_item_id)

        # Enforce storage directory existence
        os.makedirs(settings.ATTACHMENT_PATH, exist_ok=True)

        # Generate unique storage filename to avoid conflicts
        safe_id = str(uuid.uuid4())
        filename = upload_file.filename or "unnamed_file"
        file_path = os.path.join(settings.ATTACHMENT_PATH, f"{safe_id}_{filename}")

        max_bytes = settings.ATTACHMENT_MAX_SIZE_MB * 1024 * 1024
        total_bytes = 0

        # Stream write to disk while verifying size to avoid holding large files in memory
        try:
            with open(file_path, "wb") as out_file:
                while chunk := upload_file.file.read(1024 * 1024):  # 1MB chunks
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        raise ValidationError(
                            f"File size exceeds the maximum limit of {settings.ATTACHMENT_MAX_SIZE_MB} MB"
                        )
                    out_file.write(chunk)
        except Exception as e:
            # Clean up partial file on error
            if os.path.exists(file_path):
                os.remove(file_path)
            raise e

        # Create database record
        attachment = Attachment(
            work_item_id=work_item_id,
            uploaded_by_id=actor.id,
            filename=filename,
            content_type=upload_file.content_type,
            file_size=total_bytes,
            file_path=file_path,
        )
        db.add(attachment)
        db.flush()  # populate ID for audit trail

        AuditService.log(
            db,
            entity_type="attachment",
            entity_id=attachment.id,
            action="uploaded",
            actor_id=actor.id,
            actor_display=actor.login,
            new_values={
                "work_item_id": str(work_item_id),
                "filename": filename,
                "file_size": total_bytes,
            },
        )

        db.commit()
        db.refresh(attachment)

        return attachment

    @staticmethod
    def get_scoped(db: Session, actor: User, attachment_id: UUID) -> Attachment:
        """
        Retrieve an attachment and verify the user has access to its work item.
        """
        attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
        if not attachment:
            raise NotFoundError("Attachment", str(attachment_id))

        # Enforce work item access scoping rules
        WorkItemService.get_scoped(db, actor, attachment.work_item_id)

        return attachment

    @staticmethod
    def download(db: Session, actor: User, attachment_id: UUID) -> Tuple[Attachment, str]:
        """
        Retrieve attachment metadata and local storage file path.
        Verifies scope access to the corresponding work item and confirms the file exists.
        Returns (attachment, file_path).
        """
        attachment = AttachmentService.get_scoped(db, actor, attachment_id)

        # Verify the physical file exists
        if not os.path.exists(attachment.file_path):
            raise NotFoundError("Attachment file", str(attachment_id))

        return attachment, attachment.file_path
