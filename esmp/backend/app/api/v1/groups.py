"""
Admin groups API router.
Admin-only group management: list, create, manage members.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.core.exceptions import ConflictError, NotFoundError
from app.models.identity import Group, User
from app.services.audit_service import AuditService

router = APIRouter()


# ── Schemas ──

class GroupCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    type: str = Field(default="assignment", pattern="^(assignment|cab)$")
    organization_id: UUID


class GroupUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class GroupMemberRequest(BaseModel):
    user_id: UUID


class GroupMemberResponse(BaseModel):
    id: UUID
    login: str
    email: str
    role: str

    class Config:
        from_attributes = True


class GroupResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    type: str
    organization_id: UUID
    is_active: bool
    members: List[GroupMemberResponse] = []

    class Config:
        from_attributes = True


# ── Routes ──

@router.get("", response_model=List[GroupResponse])
def list_groups(
    type: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN, Role.MANAGER, Role.AGENT)),
):
    """List all groups."""
    query = db.query(Group)
    if type:
        query = query.filter(Group.type == type)
    if is_active is not None:
        query = query.filter(Group.is_active == is_active)

    groups = query.order_by(Group.name).all()
    return [
        GroupResponse(
            id=g.id,
            name=g.name,
            description=g.description,
            type=g.type,
            organization_id=g.organization_id,
            is_active=g.is_active,
            members=[
                GroupMemberResponse(
                    id=m.id,
                    login=m.login,
                    email=m.email,
                    role=m.role.value if hasattr(m.role, "value") else str(m.role),
                )
                for m in g.members
            ],
        )
        for g in groups
    ]


@router.post("", response_model=GroupResponse, status_code=201)
def create_group(
    payload: GroupCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """Create a new group (admin only)."""
    existing = db.query(Group).filter(
        Group.name == payload.name,
        Group.organization_id == payload.organization_id,
    ).first()
    if existing:
        raise ConflictError(f"Group '{payload.name}' already exists in this organization")

    group = Group(
        name=payload.name,
        description=payload.description,
        type=payload.type,
        organization_id=payload.organization_id,
    )
    db.add(group)

    AuditService.log(
        db,
        entity_type="group",
        entity_id=group.id,
        action="created",
        actor_id=current_user.id,
        actor_display=current_user.login,
        new_values={"name": group.name, "type": group.type},
    )

    db.commit()
    db.refresh(group)

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        type=group.type,
        organization_id=group.organization_id,
        is_active=group.is_active,
        members=[],
    )


@router.post("/{group_id}/members", status_code=201)
def add_member(
    group_id: UUID,
    payload: GroupMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """Add a user to a group (admin only)."""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise NotFoundError("Group", str(group_id))

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise NotFoundError("User", str(payload.user_id))

    if user in group.members:
        raise ConflictError(f"User '{user.login}' is already a member of group '{group.name}'")

    group.members.append(user)

    AuditService.log(
        db,
        entity_type="group",
        entity_id=group.id,
        action="member_added",
        actor_id=current_user.id,
        actor_display=current_user.login,
        new_values={"user_id": str(user.id), "user_login": user.login},
    )

    db.commit()
    return {"message": f"User '{user.login}' added to group '{group.name}'"}


@router.delete("/{group_id}/members/{user_id}")
def remove_member(
    group_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """Remove a user from a group (admin only)."""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise NotFoundError("Group", str(group_id))

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("User", str(user_id))

    if user not in group.members:
        raise NotFoundError("Member", str(user_id), detail=f"User is not a member of group '{group.name}'")

    group.members.remove(user)

    AuditService.log(
        db,
        entity_type="group",
        entity_id=group.id,
        action="member_removed",
        actor_id=current_user.id,
        actor_display=current_user.login,
        old_values={"user_id": str(user.id), "user_login": user.login},
    )

    db.commit()
    return {"message": f"User '{user.login}' removed from group '{group.name}'"}
