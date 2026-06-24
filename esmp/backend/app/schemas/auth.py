"""
Pydantic schemas for authentication API.
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    login: str
    password: str


class UserProfile(BaseModel):
    """User profile returned on login and /me."""
    id: str
    login: str
    email: str
    role: str
    profile: Dict[str, Any]
    groups: List[str] = []

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    user: UserProfile


class MeResponse(BaseModel):
    user: UserProfile


class RefreshResponse(BaseModel):
    message: str = "Token refreshed"


class LogoutResponse(BaseModel):
    message: str = "Logged out"
