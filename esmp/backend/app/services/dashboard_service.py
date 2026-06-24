"""
Dashboard service: aggregates counts for open tickets, SLAs, and workloads.
"""

from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.work_item import WorkItem
from app.models.identity import User, Group
from app.core.permissions import Role


def _get_scoped_query(db: Session, user: User):
    query = db.query(WorkItem).filter(WorkItem.soft_deleted_at == None)
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
    # Managers and admins see everything
    return query


class DashboardService:
    """
    Service to generate metrics for service desk dashboards.
    """

    @staticmethod
    def open_by_status(db: Session, user: User) -> dict:
        """
        Count active work items grouped by status.
        """
        query = _get_scoped_query(db, user)
        counts = (
            query.group_by(WorkItem.status)
            .with_entities(WorkItem.status, func.count(WorkItem.id))
            .all()
        )
        return {status: count for status, count in counts}

    @staticmethod
    def sla_summary(db: Session, user: User) -> dict:
        """
        Count active, at-risk, and breached SLA clocks.
        At-risk is defined as deadline - now < 20% of (deadline - started_at).
        """
        from app.models.sla import SlaClock

        # Filter clocks by scoped work items
        scoped_wi_ids = _get_scoped_query(db, user).with_entities(WorkItem.id)

        # 1. Breached clocks count
        breached_count = db.query(SlaClock).filter(
            SlaClock.work_item_id.in_(scoped_wi_ids),
            SlaClock.is_breached == True
        ).count()

        # 2. Active clocks
        active_clocks = db.query(SlaClock).filter(
            SlaClock.work_item_id.in_(scoped_wi_ids),
            SlaClock.status == "active",
            SlaClock.is_breached == False
        ).all()

        at_risk_count = 0
        now = datetime.now(timezone.utc)
        for clock in active_clocks:
            deadline = clock.deadline
            started_at = clock.started_at

            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)

            total_time = (deadline - started_at).total_seconds()
            time_left = (deadline - now).total_seconds()

            if total_time > 0 and time_left < 0.2 * total_time:
                at_risk_count += 1

        healthy_count = len(active_clocks) - at_risk_count

        # 3. Paused clocks count
        paused_count = db.query(SlaClock).filter(
            SlaClock.work_item_id.in_(scoped_wi_ids),
            SlaClock.status == "paused",
            SlaClock.is_breached == False
        ).count()

        return {
            "breached": breached_count,
            "at_risk": at_risk_count,
            "healthy": healthy_count + paused_count,
            "paused": paused_count
        }

    @staticmethod
    def workload(db: Session, user: User) -> dict:
        """
        Count open work items grouped by assigned group and assigned agent.
        """
        # Open statuses
        open_statuses = [
            "new", "assigned", "in_progress", "pending_user",
            "draft", "submitted", "pending_approval", "approved", "scheduled", "implementing"
        ]

        # Open work items visible to the user
        open_items_query = _get_scoped_query(db, user).filter(WorkItem.status.in_(open_statuses))

        # 1. Group workload
        group_counts = (
            db.query(Group.name, func.count(WorkItem.id))
            .select_from(WorkItem)
            .outerjoin(Group, WorkItem.assigned_group_id == Group.id)
            .filter(WorkItem.id.in_(open_items_query.with_entities(WorkItem.id)))
            .group_by(Group.name)
            .all()
        )

        by_group = {}
        for name, count in group_counts:
            by_group[name or "Unassigned"] = count

        # 2. Agent workload
        from app.models.identity import User as UserModel
        agent_counts = (
            db.query(UserModel.login, func.count(WorkItem.id))
            .select_from(WorkItem)
            .outerjoin(UserModel, WorkItem.assigned_to_id == UserModel.id)
            .filter(WorkItem.id.in_(open_items_query.with_entities(WorkItem.id)))
            .group_by(UserModel.login)
            .all()
        )

        by_agent = {}
        for login, count in agent_counts:
            by_agent[login or "Unassigned"] = count

        return {
            "by_group": by_group,
            "by_agent": by_agent
        }
