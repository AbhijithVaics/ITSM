"""
SLA Service: implements business-hours deadline calculations, clock updates, and breach checking.
"""

from datetime import datetime, timezone, timedelta, time as datetime_time
from typing import Optional, Set
from uuid import UUID
import pytz
import structlog

from sqlalchemy.orm import Session

from app.models.work_item import WorkItem
from app.models.sla import BusinessCalendar, Holiday, SlaPolicy, SlaClock
from app.services.notification_service import NotificationService

logger = structlog.get_logger()


def is_within_business_hours(dt: datetime, calendar: BusinessCalendar, holiday_dates: Set) -> bool:
    """Check if the given datetime is within business hours and not a holiday."""
    tz = pytz.timezone(calendar.timezone)
    dt_local = dt.astimezone(tz)
    
    if dt_local.date() in holiday_dates:
        return False
        
    # Python weekday: Monday=0, Sunday=6
    # JS weekday: Sunday=0, Monday=1, ..., Saturday=6
    js_day = (dt_local.weekday() + 1) % 7
    if js_day not in calendar.working_days:
        return False
        
    t = dt_local.time()
    return calendar.start_time <= t < calendar.end_time


def add_business_minutes(
    start_dt: datetime,
    minutes: int,
    calendar: BusinessCalendar,
    holidays: list
) -> datetime:
    """
    Calculate the future business deadline from a start datetime by adding business minutes.
    """
    tz = pytz.timezone(calendar.timezone)
    if start_dt.tzinfo is None:
        start_dt = pytz.utc.localize(start_dt)
    current = start_dt.astimezone(tz)
    
    holiday_dates = {h.date.date() if isinstance(h.date, datetime) else h.date for h in holidays}
    remaining = minutes
    
    attempts = 0
    # Prevent infinite loops (max 60 days)
    while remaining > 0 and attempts < 60 * 24 * 60:
        js_day = (current.weekday() + 1) % 7
        is_working_day = js_day in calendar.working_days and current.date() not in holiday_dates
        
        if is_working_day and calendar.start_time <= current.time() < calendar.end_time:
            # We are within business hours. Calculate remaining minutes today.
            end_of_day = current.replace(
                hour=calendar.end_time.hour,
                minute=calendar.end_time.minute,
                second=0,
                microsecond=0
            )
            avail_min = int((end_of_day - current).total_seconds() / 60)
            
            if avail_min <= 0:
                current = (current + timedelta(days=1)).replace(
                    hour=calendar.start_time.hour,
                    minute=calendar.start_time.minute,
                    second=0,
                    microsecond=0
                )
            else:
                chunk = min(remaining, avail_min)
                current += timedelta(minutes=chunk)
                remaining -= chunk
        else:
            # We are not in business hours. Find the next business start time.
            if is_working_day and current.time() < calendar.start_time:
                current = current.replace(
                    hour=calendar.start_time.hour,
                    minute=calendar.start_time.minute,
                    second=0,
                    microsecond=0
                )
            else:
                current = (current + timedelta(days=1)).replace(
                    hour=calendar.start_time.hour,
                    minute=calendar.start_time.minute,
                    second=0,
                    microsecond=0
                )
        attempts += 1
                
    return current.astimezone(timezone.utc)


class SlaService:
    """
    Manages starting, pausing, resuming, stopping SLA clocks, and detecting breaches.
    """

    @staticmethod
    def _get_active_policy(db: Session, priority: str, work_item_type: str = "incident") -> SlaPolicy:
        """Lookup policy for priority, or return standard fallback policy."""
        policy = db.query(SlaPolicy).filter(
            SlaPolicy.work_item_type == work_item_type,
            SlaPolicy.priority == priority
        ).first()
        
        if not policy:
            # Fallbacks
            fallbacks = {
                "P1": (15, 60),      # TTO = 15m, TTR = 60m
                "P2": (30, 240),     # TTO = 30m, TTR = 240m
                "P3": (60, 480),     # TTO = 60m, TTR = 480m
                "P4": (120, 960),    # TTO = 120m, TTR = 960m
            }
            resp, res = fallbacks.get(priority, (120, 960))
            policy = SlaPolicy(
                name=f"Fallback {priority} Policy",
                priority=priority,
                work_item_type=work_item_type,
                response_target_mins=resp,
                resolution_target_mins=res
            )
        return policy

    @staticmethod
    def _get_active_calendar(db: Session, calendar_id: Optional[UUID] = None) -> BusinessCalendar:
        """Lookup calendar by ID, or standard default, or fallback memory representation."""
        if calendar_id:
            cal = db.query(BusinessCalendar).filter(BusinessCalendar.id == calendar_id).first()
            if cal:
                return cal
        
        cal = db.query(BusinessCalendar).filter(BusinessCalendar.is_default == True).first()
        if cal:
            return cal
            
        cal = db.query(BusinessCalendar).first()
        if cal:
            return cal
            
        # Hard fallback memory object
        return BusinessCalendar(
            name="Default Standard Calendar",
            timezone="Asia/Kolkata",
            working_days=[1, 2, 3, 4, 5],
            start_time=datetime_time(9, 0),
            end_time=datetime_time(18, 0)
        )

    @staticmethod
    def start_clocks(db: Session, work_item: WorkItem) -> None:
        """
        Starts response and resolution SLA clocks for a new incident.
        """
        if work_item.work_item_type != "incident":
            return

        logger.info("Initializing SLA clocks", work_item_id=str(work_item.id), priority=work_item.priority)

        # Lookup policy & calendar
        policy = SlaService._get_active_policy(db, work_item.priority or "P4")
        calendar = SlaService._get_active_calendar(db, policy.calendar_id)
        holidays = db.query(Holiday).filter(Holiday.calendar_id == calendar.id).all() if calendar.id else []

        now = datetime.now(timezone.utc)

        # Calculate TTO & TTR deadlines
        tto_deadline = add_business_minutes(now, policy.response_target_mins, calendar, holidays)
        ttr_deadline = add_business_minutes(now, policy.resolution_target_mins, calendar, holidays)

        # Update denormalized deadline on work item spine for performance
        work_item.resolution_deadline = ttr_deadline

        # Create clocks
        tto_clock = SlaClock(
            work_item_id=work_item.id,
            metric="response",
            status="active",
            started_at=now,
            deadline=tto_deadline,
        )
        ttr_clock = SlaClock(
            work_item_id=work_item.id,
            metric="resolution",
            status="active",
            started_at=now,
            deadline=ttr_deadline,
        )

        db.add(tto_clock)
        db.add(ttr_clock)
        db.flush()
        logger.info("Created response and resolution clocks", work_item_id=str(work_item.id), response_deadline=str(tto_deadline), resolution_deadline=str(ttr_deadline))

    @staticmethod
    def on_first_response(db: Session, work_item_id: UUID, actor) -> None:
        """
        Stops the response SLA clock. Triggered by a comment or direct assignment update.
        """
        # Ensure first_response_at isn't already set
        work_item = db.query(WorkItem).filter(WorkItem.id == work_item_id).first()
        if not work_item or work_item.first_response_at is not None:
            return

        # Double check if actor is an agent/manager/admin
        actor_role = actor.role.value if hasattr(actor.role, "value") else str(actor.role)
        if actor_role not in ["agent", "manager", "admin"]:
            # Requesters do not count as first response!
            return

        now = datetime.now(timezone.utc)
        work_item.first_response_at = now

        # Update the response clock
        clock = db.query(SlaClock).filter(
            SlaClock.work_item_id == work_item_id,
            SlaClock.metric == "response",
            SlaClock.status == "active"
        ).first()

        if clock:
            clock.status = "stopped"
            if now > clock.deadline:
                clock.is_breached = True
                clock.breached_at = clock.deadline
                logger.info("Response clock stopped, BREACHED", work_item_id=str(work_item_id))
            else:
                logger.info("Response clock stopped, MET", work_item_id=str(work_item_id))
            db.flush()

    @staticmethod
    def on_status_change(db: Session, work_item: WorkItem, new_status: str) -> None:
        """
        Pauses, resumes, or stops clocks based on status change.
        - Pauses on pending_user
        - Resumes on assigned/in_progress from pending_user
        - Stops on resolved/closed/cancelled
        """
        now = datetime.now(timezone.utc)

        # Resolution clock tracking
        res_clock = db.query(SlaClock).filter(
            SlaClock.work_item_id == work_item.id,
            SlaClock.metric == "resolution"
        ).first()

        if not res_clock:
            return

        if new_status == "pending_user":
            if res_clock.status == "active":
                res_clock.status = "paused"
                res_clock.paused_at = now
                logger.info("Resolution SLA paused", work_item_id=str(work_item.id))
        
        elif new_status in ["in_progress", "assigned"]:
            if res_clock.status == "paused" and res_clock.paused_at:
                elapsed_seconds = (now - res_clock.paused_at).total_seconds()
                elapsed_mins = int(elapsed_seconds / 60)
                
                # Push the deadline out by paused minutes
                res_clock.deadline += timedelta(minutes=elapsed_mins)
                res_clock.accumulated_active_mins += int((res_clock.paused_at - res_clock.started_at).total_seconds() / 60)
                res_clock.paused_at = None
                res_clock.status = "active"
                
                # Keep work_item spine updated
                work_item.resolution_deadline = res_clock.deadline
                logger.info("Resolution SLA resumed", work_item_id=str(work_item.id), adjusted_deadline=str(res_clock.deadline))
        
        elif new_status in ["resolved", "closed", "cancelled"]:
            # Stop resolution clock
            if res_clock.status in ["active", "paused"]:
                res_clock.status = "stopped"
                if res_clock.status == "paused" and res_clock.paused_at:
                     # Calculate up to pause time
                     pass
                if now > res_clock.deadline:
                    res_clock.is_breached = True
                    res_clock.breached_at = res_clock.deadline
                    logger.info("Resolution SLA stopped, BREACHED", work_item_id=str(work_item.id))
                else:
                    logger.info("Resolution SLA stopped, MET", work_item_id=str(work_item.id))
            
            # Also close response clock if active
            resp_clock = db.query(SlaClock).filter(
                SlaClock.work_item_id == work_item.id,
                SlaClock.metric == "response",
                SlaClock.status == "active"
            ).first()
            if resp_clock:
                resp_clock.status = "stopped"
                if now > resp_clock.deadline:
                    resp_clock.is_breached = True
                    resp_clock.breached_at = resp_clock.deadline
                db.flush()

        elif new_status == "reopen":
            # If reopened, restart resolution clock
            if res_clock.status == "stopped":
                res_clock.status = "active"
                # If was breached, keep is_breached=True, otherwise reset or keep old deadline
                logger.info("Resolution SLA restarted/resumed on reopen", work_item_id=str(work_item.id))

        db.flush()

    @staticmethod
    def check_breaches(db: Session) -> int:
        """
        Check for any active clocks that have passed their deadline.
        Flags them as breached and creates breach notifications.
        Returns the number of newly breached clocks.
        """
        now = datetime.now(timezone.utc)
        active_clocks = db.query(SlaClock).filter(
            SlaClock.status == "active",
            SlaClock.deadline < now,
            SlaClock.is_breached == False
        ).all()

        breached_count = 0
        for clock in active_clocks:
            clock.is_breached = True
            clock.breached_at = clock.deadline
            clock.status = "breached"
            breached_count += 1

            # Dispatch notification
            work_item = clock.work_item
            if work_item:
                # Notify assignee/group members, or reporter
                title = f"SLA Breach: {work_item.display_id}"
                msg = f"The SLA clock for {clock.metric} has breached on work item: '{work_item.title}'."
                
                # Send to assigned agent
                if work_item.assigned_to_id:
                    NotificationService.dispatch(
                        db=db,
                        user_id=work_item.assigned_to_id,
                        event_type="sla_breach",
                        entity_id=work_item.id,
                        entity_type="work_item",
                        title=title,
                        message=msg
                    )
                
                logger.warn("SLA breach detected", work_item_id=str(work_item.id), metric=clock.metric, deadline=str(clock.deadline))

        if breached_count > 0:
            db.commit()

        return breached_count

    @staticmethod
    def get_policies(db: Session):
        return db.query(SlaPolicy).order_by(SlaPolicy.priority).all()

    @staticmethod
    def create_policy(db: Session, data) -> SlaPolicy:
        policy = SlaPolicy(
            name=data.name,
            description=data.description,
            work_item_type=data.work_item_type,
            priority=data.priority,
            response_target_mins=data.response_target_mins,
            resolution_target_mins=data.resolution_target_mins,
            calendar_id=data.calendar_id,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
        return policy

    @staticmethod
    def update_policy(db: Session, policy_id: UUID, data) -> SlaPolicy:
        from app.core.exceptions import NotFoundError
        policy = db.query(SlaPolicy).filter(SlaPolicy.id == policy_id).first()
        if not policy:
            raise NotFoundError("SlaPolicy", str(policy_id))
        policy.name = data.name
        policy.description = data.description
        policy.work_item_type = data.work_item_type
        policy.priority = data.priority
        policy.response_target_mins = data.response_target_mins
        policy.resolution_target_mins = data.resolution_target_mins
        policy.calendar_id = data.calendar_id
        db.commit()
        db.refresh(policy)
        return policy

    @staticmethod
    def delete_policy(db: Session, policy_id: UUID) -> None:
        from app.core.exceptions import NotFoundError
        policy = db.query(SlaPolicy).filter(SlaPolicy.id == policy_id).first()
        if not policy:
            raise NotFoundError("SlaPolicy", str(policy_id))
        db.delete(policy)
        db.commit()

    @staticmethod
    def get_calendars(db: Session):
        return db.query(BusinessCalendar).all()

    @staticmethod
    def create_calendar(db: Session, data) -> BusinessCalendar:
        from datetime import time
        if data.is_default:
            db.query(BusinessCalendar).update({BusinessCalendar.is_default: False})
        
        calendar = BusinessCalendar(
            name=data.name,
            timezone=data.timezone,
            working_days=data.working_days,
            start_time=time.fromisoformat(data.start_time),
            end_time=time.fromisoformat(data.end_time),
            is_default=data.is_default,
        )
        db.add(calendar)
        db.commit()
        db.refresh(calendar)
        return calendar

    @staticmethod
    def update_calendar(db: Session, calendar_id: UUID, data) -> BusinessCalendar:
        from app.core.exceptions import NotFoundError
        from datetime import time
        calendar = db.query(BusinessCalendar).filter(BusinessCalendar.id == calendar_id).first()
        if not calendar:
            raise NotFoundError("BusinessCalendar", str(calendar_id))
        
        if data.is_default:
            db.query(BusinessCalendar).filter(BusinessCalendar.id != calendar_id).update({BusinessCalendar.is_default: False})
            
        calendar.name = data.name
        calendar.timezone = data.timezone
        calendar.working_days = data.working_days
        calendar.start_time = time.fromisoformat(data.start_time)
        calendar.end_time = time.fromisoformat(data.end_time)
        calendar.is_default = data.is_default
        
        db.commit()
        db.refresh(calendar)
        return calendar

    @staticmethod
    def delete_calendar(db: Session, calendar_id: UUID) -> None:
        from app.core.exceptions import NotFoundError
        calendar = db.query(BusinessCalendar).filter(BusinessCalendar.id == calendar_id).first()
        if not calendar:
            raise NotFoundError("BusinessCalendar", str(calendar_id))
        db.delete(calendar)
        db.commit()
