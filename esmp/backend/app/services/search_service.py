"""
Search service: performs scoped ILIKE search over work items.
"""

from typing import Optional, List, Tuple
from uuid import UUID
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.work_item import WorkItem
from app.models.identity import User
from app.core.permissions import Role


class SearchService:
    """
    Handles searching across work items using database ILIKE matches.
    Enforces the same RBAC scoping policies as WorkItemService.
    """

    @staticmethod
    def search_work_items(
        db: Session,
        user: User,
        q: str,
        limit: int = 50,
        cursor: Optional[str] = None,
    ) -> Tuple[List[WorkItem], Optional[str]]:
        """
        Search work items by display_id, title, or reporter email, respecting user scope.
        """
        query = (
            db.query(WorkItem)
            .options(joinedload(WorkItem.incident_extension), joinedload(WorkItem.change_extension))
            .filter(WorkItem.soft_deleted_at == None)
        )

        # ── Scope filtering (same as list_work_items) ──
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)

        if user_role == Role.REQUESTER.value:
            query = query.filter(
                WorkItem.reported_by_id == user.id,
                WorkItem.work_item_type != "change"
            )
        elif user_role == Role.AGENT.value:
            user_group_ids = [g.id for g in user.groups]
            query = query.filter(
                (WorkItem.assigned_to_id == user.id)
                | (WorkItem.assigned_group_id.in_(user_group_ids))
                | (WorkItem.reported_by_id == user.id)
            )
        elif user_role in (Role.CHANGE_MANAGER.value, Role.CAB_MEMBER.value):
            query = query.filter(
                (WorkItem.work_item_type == "change")
                | (WorkItem.reported_by_id == user.id)
            )
        # Managers and Admins see everything

        # ── Apply ILIKE Search Filter ──
        if q:
            search_term = f"%{q}%"
            from app.models.identity import User as UserModel
            query = query.outerjoin(WorkItem.reported_by).filter(
                or_(
                    WorkItem.display_id.ilike(search_term),
                    WorkItem.title.ilike(search_term),
                    UserModel.email.ilike(search_term),
                )
            )

        # ── Sorting & Keyset Cursor Pagination ──
        query = query.order_by(
            WorkItem.resolution_deadline.asc().nullslast(),
            WorkItem.created_at.desc(),
        )

        if cursor:
            try:
                from datetime import datetime
                parts = cursor.split(",", 1)
                cursor_ts = datetime.fromisoformat(parts[0])
                cursor_id = parts[1]
                query = query.filter(
                    (WorkItem.created_at < cursor_ts)
                    | ((WorkItem.created_at == cursor_ts) & (WorkItem.id > cursor_id))
                )
            except (ValueError, IndexError):
                pass

        items = query.limit(limit + 1).all()

        next_cursor = None
        if len(items) > limit:
            items = items[:limit]
            last = items[-1]
            next_cursor = f"{last.created_at.isoformat()},{last.id}"

        return items, next_cursor
