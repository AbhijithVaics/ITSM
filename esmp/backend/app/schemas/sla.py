"""
Pydantic schemas for SLA Engine configurations (policies & business calendars).
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel


class HolidayBase(BaseModel):
    name: str
    date: datetime


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: UUID
    calendar_id: UUID

    class Config:
        from_attributes = True


class BusinessCalendarBase(BaseModel):
    name: str
    timezone: str = "Asia/Kolkata"
    working_days: List[int] = [1, 2, 3, 4, 5]
    start_time: str  # e.g., "09:00:00"
    end_time: str    # e.g., "18:00:00"
    is_default: bool = False


class BusinessCalendarCreate(BusinessCalendarBase):
    pass


class BusinessCalendarResponse(BaseModel):
    id: UUID
    name: str
    timezone: str
    working_days: List[int]
    start_time: str  # string formatted
    end_time: str    # string formatted
    is_default: bool
    holidays: List[HolidayResponse] = []

    class Config:
        from_attributes = True


class SlaPolicyBase(BaseModel):
    name: str
    description: Optional[str] = None
    work_item_type: str = "incident"
    priority: str
    response_target_mins: int
    resolution_target_mins: int
    calendar_id: Optional[UUID] = None


class SlaPolicyCreate(SlaPolicyBase):
    pass


class SlaPolicyResponse(SlaPolicyBase):
    id: UUID

    class Config:
        from_attributes = True
