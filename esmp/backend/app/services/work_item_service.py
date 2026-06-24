"""
Work item service: core CRUD operations, display ID generation, and scoped access.
"""

from datetime import datetime, timezone
from typing import Optional, List
from uuid import UUID

from sqlalchemy import func as sa_func, text
from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.permissions import Role
from app.domain.constants import DISPLAY_ID_PREFIX
from app.domain.enums import IncidentStatus, WorkItemType
from app.models.identity import User, Group
from app.models.work_item import WorkItem
from app.models.incident import IncidentExtension
from app.services.audit_service import AuditService


class WorkItemService:
    """
    Core work item operations.
    All mutations flow through this service to ensure audit + scope checks.
    """

    @staticmethod
    def generate_display_id(db: Session, work_item_type: str) -> str:
        """
        Generate a unique display ID like INC-20260624-0001.
        Uses a row-level advisory lock to prevent race conditions.
        """
        prefix = DISPLAY_ID_PREFIX.get(work_item_type, "WI")
        date_part = datetime.now(timezone.utc).strftime("%Y%m%d")

        # Use advisory lock for concurrency safety
        lock_key = hash(f"{prefix}{date_part}") & 0x7FFFFFFF
        db.execute(text(f"SELECT pg_advisory_xact_lock({lock_key})"))

        # Get or create sequence row using raw SQL for atomicity
        result = db.execute(
            text("""
                INSERT INTO work_item.display_id_sequences (id, prefix, date_part, next_seq)
                VALUES (gen_random_uuid(), :prefix, :date_part, 1)
                ON CONFLICT (prefix, date_part)
                DO UPDATE SET next_seq = work_item.display_id_sequences.next_seq + 1
                RETURNING next_seq
            """),
            {"prefix": prefix, "date_part": date_part},
        )
        seq = result.scalar()
        return f"{prefix}-{date_part}-{seq:04d}"

    @staticmethod
    def get_scoped(db: Session, user: User, work_item_id: UUID) -> WorkItem:
        """
        Load a work item with scope check.
        - Requesters can only see their own tickets.
        - Agents see tickets assigned to their groups.
        - Managers/admins see all.
        """
        work_item = (
            db.query(WorkItem)
            .options(joinedload(WorkItem.incident_extension), joinedload(WorkItem.change_extension))
            .filter(WorkItem.id == work_item_id, WorkItem.soft_deleted_at == None)
            .first()
        )
        if not work_item:
            raise NotFoundError("Work item", str(work_item_id))

        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)

        # Admins and managers see everything
        if user_role in (Role.ADMIN.value, Role.MANAGER.value):
            return work_item

        # Requesters can only see their own tickets, and they CANNOT see changes
        if user_role == Role.REQUESTER.value:
            if work_item.work_item_type == WorkItemType.CHANGE.value:
                raise NotFoundError("Work item", str(work_item_id))
            if work_item.reported_by_id != user.id:
                raise NotFoundError("Work item", str(work_item_id))
            return work_item

        # Agents see tickets assigned to their groups
        if user_role == Role.AGENT.value:
            user_group_ids = {g.id for g in user.groups}
            if (
                work_item.assigned_to_id == user.id
                or work_item.assigned_group_id in user_group_ids
                or work_item.reported_by_id == user.id
            ):
                return work_item
            raise NotFoundError("Work item", str(work_item_id))

        # Change managers and CAB members see changes
        if user_role in (Role.CHANGE_MANAGER.value, Role.CAB_MEMBER.value):
            if work_item.work_item_type == WorkItemType.CHANGE.value:
                return work_item
            # Also see their own items
            if work_item.reported_by_id == user.id:
                return work_item
            raise NotFoundError("Work item", str(work_item_id))

        return work_item

    @staticmethod
    def list_work_items(
        db: Session,
        user: User,
        *,
        work_item_type: Optional[str] = None,
        status: Optional[str] = None,
        assigned_group_id: Optional[UUID] = None,
        assigned_to_id: Optional[UUID] = None,
        reported_by_id: Optional[UUID] = None,
        source: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> tuple[List[WorkItem], Optional[str]]:
        """
        List work items with filtering and keyset pagination.
        Applies scope restrictions based on user role.
        """
        query = (
            db.query(WorkItem)
            .options(joinedload(WorkItem.incident_extension), joinedload(WorkItem.change_extension))
            .filter(WorkItem.soft_deleted_at == None)
        )

        # ── Scope filtering ──
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)

        if user_role == Role.REQUESTER.value:
            query = query.filter(WorkItem.reported_by_id == user.id, WorkItem.work_item_type != WorkItemType.CHANGE.value)
        elif user_role == Role.AGENT.value:
            user_group_ids = [g.id for g in user.groups]
            query = query.filter(
                (WorkItem.assigned_to_id == user.id)
                | (WorkItem.assigned_group_id.in_(user_group_ids))
                | (WorkItem.reported_by_id == user.id)
            )
        # Managers and admins see everything

        # ── Explicit filters ──
        if work_item_type:
            query = query.filter(WorkItem.work_item_type == work_item_type)
        if status:
            query = query.filter(WorkItem.status == status)
        if assigned_group_id:
            query = query.filter(WorkItem.assigned_group_id == assigned_group_id)
        if assigned_to_id:
            query = query.filter(WorkItem.assigned_to_id == assigned_to_id)
        if reported_by_id:
            query = query.filter(WorkItem.reported_by_id == reported_by_id)
        if source:
            query = query.filter(WorkItem.source == source)

        # ── Search (ILIKE) ──
        if q:
            search_term = f"%{q}%"
            from app.models.identity import User as UserModel
            query = query.outerjoin(WorkItem.reported_by).filter(
                (WorkItem.display_id.ilike(search_term))
                | (WorkItem.title.ilike(search_term))
                | (UserModel.email.ilike(search_term))
            )

        # ── Sort: resolution_deadline ASC NULLS LAST ──
        query = query.order_by(
            WorkItem.resolution_deadline.asc().nullslast(),
            WorkItem.created_at.desc(),
        )

        # ── Keyset cursor ──
        if cursor:
            # Cursor format: "timestamp,uuid"
            try:
                parts = cursor.split(",", 1)
                cursor_ts = datetime.fromisoformat(parts[0])
                cursor_id = parts[1]
                query = query.filter(
                    (WorkItem.created_at < cursor_ts)
                    | ((WorkItem.created_at == cursor_ts) & (WorkItem.id > cursor_id))
                )
            except (ValueError, IndexError):
                pass  # Invalid cursor — ignore

        items = query.limit(limit + 1).all()

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            last = items[-1]
            next_cursor = f"{last.created_at.isoformat()},{last.id}"

        return items, next_cursor

    @staticmethod
    def update_work_item(
        db: Session,
        user: User,
        work_item_id: UUID,
        *,
        title: Optional[str] = None,
        description: Optional[str] = None,
        assigned_to_id: Optional[UUID] = None,
        assigned_group_id: Optional[UUID] = None,
        priority: Optional[str] = None,
    ) -> WorkItem:
        """
        Partial update of work item fields.
        Writes audit trail for each changed field.
        """
        work_item = WorkItemService.get_scoped(db, user, work_item_id)

        old_values = {}
        new_values = {}

        if title is not None and title != work_item.title:
            old_values["title"] = work_item.title
            work_item.title = title
            new_values["title"] = title

        if description is not None and description != work_item.description:
            old_values["description"] = work_item.description
            work_item.description = description
            new_values["description"] = description

        if assigned_to_id is not None and assigned_to_id != work_item.assigned_to_id:
            old_values["assigned_to_id"] = str(work_item.assigned_to_id) if work_item.assigned_to_id else None
            work_item.assigned_to_id = assigned_to_id
            new_values["assigned_to_id"] = str(assigned_to_id)

        if assigned_group_id is not None and assigned_group_id != work_item.assigned_group_id:
            old_values["assigned_group_id"] = str(work_item.assigned_group_id) if work_item.assigned_group_id else None
            work_item.assigned_group_id = assigned_group_id
            new_values["assigned_group_id"] = str(assigned_group_id)

        if priority is not None and priority != work_item.priority:
            old_values["priority"] = work_item.priority
            work_item.priority = priority
            new_values["priority"] = priority

        if new_values:
            AuditService.log(
                db,
                entity_type="work_item",
                entity_id=work_item.id,
                action="updated",
                actor_id=user.id,
                actor_display=user.login,
                old_values=old_values,
                new_values=new_values,
            )
            db.commit()

        return work_item
