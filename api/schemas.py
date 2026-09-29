"""
Pydantic schemas untuk request/response API.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_name: str


# ---------- Event ----------
class EventBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    quota: Optional[int] = Field(default=None, ge=1)
    is_published: bool = True


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = None
    image_url: Optional[str] = None
    category: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    quota: Optional[int] = Field(default=None, ge=1)
    is_published: Optional[bool] = None


class EventOut(EventBase):
    id: str
    created_at: datetime
    registered_count: int = 0
    checked_in_count: int = 0

    class Config:
        from_attributes = True


# ---------- Registration ----------
class RegistrationCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)


class RegistrationOut(BaseModel):
    id: str
    event_id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    ticket_token: str
    is_checked_in: bool
    checked_in_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RegistrationConfirmOut(RegistrationOut):
    qr_code_base64: str
    event_title: str


class CheckInRequest(BaseModel):
    ticket_token: str


class CheckInResponse(BaseModel):
    success: bool
    message: str
    registration: Optional[RegistrationOut] = None


class RegistrationListItem(RegistrationOut):
    pass
