"""
Admin users API router.
Admin-only user management: list, create, update, deactivate.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import Role, require_roles
from app.core.security import get_password_hash
from app.core.exceptions import ConflictError, NotFoundError
from app.models.identity import User, UserRole
from app.services.audit_service import AuditService

router = APIRouter()


# ── Schemas ──

class UserCreateRequest(BaseModel):
    login: str = Field(..., min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(default="requester")
    organization_id: UUID
    profile: dict = Field(default_factory=dict)


class UserUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    profile: Optional[dict] = None


class UserResponse(BaseModel):
    id: UUID
    login: str
    email: str
    role: str
    is_active: bool
    profile: dict
    organization_id: UUID
    groups: List[str] = []

    class Config:
        from_attributes = True


# ── Routes ──

@router.get("", response_model=List[UserResponse])
def list_users(
    is_active: Optional[bool] = Query(default=None),
    role: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """List all users (admin only)."""
    query = db.query(User)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if role:
        query = query.filter(User.role == role)
    if q:
        search = f"%{q}%"
        query = query.filter(
            (User.login.ilike(search)) | (User.email.ilike(search))
        )

    users = query.order_by(User.login).all()
    return [
        UserResponse(
            id=u.id,
            login=u.login,
            email=u.email,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            is_active=u.is_active,
            profile=u.profile or {},
            organization_id=u.organization_id,
            groups=[g.name for g in u.groups],
        )
        for u in users
    ]


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """Create a new user (admin only)."""
    # Check uniqueness
    existing = db.query(User).filter(
        (User.login == payload.login) | (User.email == payload.email)
    ).first()
    if existing:
        raise ConflictError("A user with this login or email already exists")

    user = User(
        login=payload.login,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        role=UserRole(payload.role),
        organization_id=payload.organization_id,
        profile=payload.profile,
    )
    db.add(user)

    AuditService.log(
        db,
        entity_type="user",
        entity_id=user.id,
        action="created",
        actor_id=current_user.id,
        actor_display=current_user.login,
        new_values={"login": user.login, "email": user.email, "role": payload.role},
    )

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        login=user.login,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_active=user.is_active,
        profile=user.profile or {},
        organization_id=user.organization_id,
        groups=[],
    )


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.ADMIN)),
):
    """Update a user (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundError("User", str(user_id))

    old_values = {}
    new_values = {}

    if payload.email is not None and payload.email != user.email:
        old_values["email"] = user.email
        user.email = payload.email
        new_values["email"] = payload.email

    if payload.role is not None:
        old_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        if payload.role != old_role:
            old_values["role"] = old_role
            user.role = UserRole(payload.role)
            new_values["role"] = payload.role

    if payload.is_active is not None and payload.is_active != user.is_active:
        old_values["is_active"] = user.is_active
        user.is_active = payload.is_active
        new_values["is_active"] = payload.is_active

    if payload.profile is not None:
        user.profile = payload.profile
        new_values["profile"] = "updated"

    if new_values:
        AuditService.log(
            db,
            entity_type="user",
            entity_id=user.id,
            action="updated",
            actor_id=current_user.id,
            actor_display=current_user.login,
            old_values=old_values,
            new_values=new_values,
        )
        db.commit()

    db.refresh(user)
    return UserResponse(
        id=user.id,
        login=user.login,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_active=user.is_active,
        profile=user.profile or {},
        organization_id=user.organization_id,
        groups=[g.name for g in user.groups],
    )
