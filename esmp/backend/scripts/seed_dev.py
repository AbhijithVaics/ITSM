"""
Database seeding script to populate required default groups, calendars, policies, and test users.
"""

import os
import sys
import uuid
from datetime import time

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.security import get_password_hash

# Import all models to register them in SQLAlchemy class registry
from app.models.identity import User, Group, UserRole
from app.models.work_item import WorkItem
from app.models.incident import IncidentExtension
from app.models.change import ChangeExtension
from app.models.comment import Comment
from app.models.attachment import Attachment
from app.models.audit import AuditLog
from app.models.approval import Approval
from app.models.notification import Notification
from app.models.sla import BusinessCalendar, SlaPolicy, SlaClock

def seed():
    db = SessionLocal()
    # Consistent fixed organization UUID for local development
    org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    
    try:
        print("Starting dev database seed...")
        
        # 1. Groups
        service_desk = db.query(Group).filter(Group.name == "Service Desk", Group.organization_id == org_id).first()
        if not service_desk:
            service_desk = Group(
                name="Service Desk", 
                description="Main service desk/IT support group",
                organization_id=org_id,
                type="assignment"
            )
            db.add(service_desk)
            db.flush()
            print("Seeded group: Service Desk")

        change_cab = db.query(Group).filter(Group.name == "Change CAB", Group.organization_id == org_id).first()
        if not change_cab:
            change_cab = Group(
                name="Change CAB", 
                description="Change Advisory Board",
                organization_id=org_id,
                type="cab"
            )
            db.add(change_cab)
            db.flush()
            print("Seeded group: Change CAB")

        # 2. Business Calendar
        calendar = db.query(BusinessCalendar).filter(BusinessCalendar.name == "Standard Business Calendar").first()
        if not calendar:
            calendar = BusinessCalendar(
                name="Standard Business Calendar",
                timezone="Asia/Kolkata",
                working_days=[1, 2, 3, 4, 5],
                start_time=time(9, 0),
                end_time=time(18, 0),
                is_default=True
            )
            db.add(calendar)
            db.flush()
            print("Seeded Business Calendar: Standard Business Calendar")

        # 3. SLA Policies for Incidents
        policies_data = [
            {"priority": "P1", "resp": 15, "res": 60},
            {"priority": "P2", "resp": 30, "res": 240},
            {"priority": "P3", "resp": 60, "res": 480},
            {"priority": "P4", "resp": 120, "res": 960},
        ]
        for p in policies_data:
            exists = db.query(SlaPolicy).filter(
                SlaPolicy.work_item_type == "incident",
                SlaPolicy.priority == p["priority"]
            ).first()
            if not exists:
                policy = SlaPolicy(
                    name=f"Incident {p['priority']} Target",
                    priority=p["priority"],
                    work_item_type="incident",
                    response_target_mins=p["resp"],
                    resolution_target_mins=p["res"],
                    calendar_id=calendar.id
                )
                db.add(policy)
                print(f"Seeded SLA Policy: Incident {p['priority']}")

        # 4. Matrix of Test Users
        users_data = [
            {"login": "admin", "email": "admin@company.com", "role": UserRole.ADMIN, "groups": []},
            {"login": "manager1", "email": "manager1@company.com", "role": UserRole.MANAGER, "groups": [service_desk]},
            {"login": "manager2", "email": "manager2@company.com", "role": UserRole.MANAGER, "groups": [change_cab]},
            {"login": "agent1", "email": "agent1@company.com", "role": UserRole.AGENT, "groups": [service_desk]},
            {"login": "agent2", "email": "agent2@company.com", "role": UserRole.AGENT, "groups": [change_cab]},
            {"login": "change_mgr", "email": "changemgr@company.com", "role": UserRole.CHANGE_MANAGER, "groups": []},
            {"login": "cab_member1", "email": "cab1@company.com", "role": UserRole.CAB_MEMBER, "groups": [change_cab]},
            {"login": "requester1", "email": "req1@company.com", "role": UserRole.REQUESTER, "groups": []},
            {"login": "requester2", "email": "req2@company.com", "role": UserRole.REQUESTER, "groups": []},
        ]
        
        for u in users_data:
            exists = db.query(User).filter(User.login == u["login"], User.organization_id == org_id).first()
            if not exists:
                user = User(
                    login=u["login"],
                    email=u["email"],
                    password_hash=get_password_hash("password123"), # Default password for all dev users
                    role=u["role"],
                    organization_id=org_id,
                    is_active=True
                )
                db.add(user)
                db.flush()
                # Attach groups
                for g in u["groups"]:
                    user.groups.append(g)
                print(f"Seeded user: {u['login']} ({u['role'].value})")
                    
        db.commit()
        print("Dev database seeded successfully!")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
