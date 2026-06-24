"""
Authentication API router.
Endpoints: login, logout, refresh, me.
Uses HttpOnly cookies for JWT transport (no Authorization header).
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.identity import RefreshToken, User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    MeResponse,
    RefreshResponse,
    UserProfile,
)
from app.services.audit_service import AuditService

router = APIRouter()


def _hash_token(token: str) -> str:
    """Hash a refresh token for storage (we never store raw tokens)."""
    return hashlib.sha256(token.encode()).hexdigest()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set HttpOnly cookies for both access and refresh tokens."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth",  # Restrict refresh token to auth endpoints
    )


def _clear_auth_cookies(response: Response):
    """Clear authentication cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth")


def _build_user_profile(user: User) -> UserProfile:
    """Build a UserProfile from a User ORM object."""
    return UserProfile(
        id=str(user.id),
        login=user.login,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        profile=user.profile or {},
        groups=[g.name for g in user.groups] if user.groups else [],
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticates a user, sets HttpOnly access + refresh token cookies,
    and returns the user profile.
    """
    user = db.query(User).filter(User.login == payload.login).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Generate tokens
    access_token = create_access_token(
        subject=str(user.id),
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        org_id=str(user.organization_id),
    )
    raw_refresh = create_refresh_token()

    # Store hashed refresh token
    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(rt)

    # Audit login
    AuditService.log(
        db,
        entity_type="user",
        entity_id=user.id,
        action="login",
        actor_id=user.id,
        actor_display=user.login,
    )
    db.commit()

    # Set cookies
    _set_auth_cookies(response, access_token, raw_refresh)

    return LoginResponse(user=_build_user_profile(user))


@router.post("/logout", response_model=LogoutResponse)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    refresh_token: Optional[str] = Cookie(default=None),
):
    """
    Logs out the user by revoking the refresh token and clearing cookies.
    """
    if refresh_token:
        token_hash = _hash_token(refresh_token)
        rt = db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == current_user.id,
        ).first()
        if rt:
            rt.is_revoked = True

    AuditService.log(
        db,
        entity_type="user",
        entity_id=current_user.id,
        action="logout",
        actor_id=current_user.id,
        actor_display=current_user.login,
    )
    db.commit()

    _clear_auth_cookies(response)
    return LogoutResponse()


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: Optional[str] = Cookie(default=None),
):
    """
    Rotates the refresh token and issues a new access token.
    The old refresh token is revoked.
    """
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    token_hash = _hash_token(refresh_token)
    rt = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.is_revoked == False,
    ).first()

    if not rt or rt.expires_at < datetime.now(timezone.utc):
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = db.query(User).filter(User.id == rt.user_id, User.is_active == True).first()
    if not user:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Revoke old token
    rt.is_revoked = True

    # Issue new tokens
    new_access = create_access_token(
        subject=str(user.id),
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        org_id=str(user.organization_id),
    )
    new_raw_refresh = create_refresh_token()
    new_rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(new_raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_rt)
    db.commit()

    _set_auth_cookies(response, new_access, new_raw_refresh)
    return RefreshResponse()


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    """
    Returns the current authenticated user's profile, roles, and group memberships.
    """
    return MeResponse(user=_build_user_profile(current_user))
