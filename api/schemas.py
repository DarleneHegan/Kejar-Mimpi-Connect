"""
Pydantic schemas untuk request/response API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
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
    is_published: bool = False
    requires_approval: bool = False
    is_closed: bool = False


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
    requires_approval: Optional[bool] = None
    is_closed: Optional[bool] = None


class EventOut(EventBase):
    id: str
    created_at: datetime
    registered_count: int = 0
    checked_in_count: int = 0
    pending_count: int = 0

    class Config:
        from_attributes = True


# ---------- Event Form Field (Form Builder) ----------
ALLOWED_FIELD_TYPES = {"text", "number", "email", "phone", "textarea", "dropdown", "radio", "checkbox"}


class EventFormFieldBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    field_type: str = Field(default="text")
    options: Optional[List[str]] = None
    is_required: bool = False
    order: int = 0

    def validate_type(self):
        if self.field_type not in ALLOWED_FIELD_TYPES:
            raise ValueError(f"field_type harus salah satu dari: {', '.join(sorted(ALLOWED_FIELD_TYPES))}")
        if self.field_type in {"dropdown", "radio", "checkbox"} and not self.options:
            raise ValueError(f"Field tipe '{self.field_type}' membutuhkan minimal 1 opsi")


class EventFormFieldCreate(EventFormFieldBase):
    pass


class EventFormFieldUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    field_type: Optional[str] = None
    options: Optional[List[str]] = None
    is_required: Optional[bool] = None
    order: Optional[int] = None


class EventFormFieldOut(EventFormFieldBase):
    id: str
    event_id: str

    class Config:
        from_attributes = True


class EventFormFieldsReplaceRequest(BaseModel):
    """Payload untuk menyimpan ulang seluruh daftar field form suatu event sekaligus (dipakai dari form builder admin)."""
    fields: List[EventFormFieldCreate] = Field(..., min_length=1)


# ---------- Registration ----------
class RegistrationCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    answers: Optional[Dict[str, Any]] = None  # {field_id: jawaban} untuk custom form field


class RegistrationOut(BaseModel):
    id: str
    event_id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    custom_answers: Optional[Dict[str, Any]] = None
    ticket_token: str
    status: str
    is_checked_in: bool
    checked_in_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RegistrationConfirmOut(RegistrationOut):
    qr_code_base64: Optional[str] = None
    event_title: str


class RejectRequest(BaseModel):
    remarks: str = Field(..., min_length=3, max_length=1000)


class BulkDecisionRequest(BaseModel):
    registration_ids: List[str] = Field(..., min_length=1, max_length=1000)
    action: str = Field(..., pattern="^(approve|reject)$")
    remarks: Optional[str] = Field(default=None, max_length=1000)  # wajib jika action=reject


class BulkDecisionResponse(BaseModel):
    success: bool
    message: str
    processed: int
    skipped: int


class RegistrationApprovalResponse(BaseModel):
    success: bool
    message: str
    registration: Optional[RegistrationOut] = None


class CheckInRequest(BaseModel):
    ticket_token: str


class CheckInResponse(BaseModel):
    success: bool
    message: str
    registration: Optional[RegistrationOut] = None


class RegistrationListItem(RegistrationOut):
    """Versi admin: termasuk catatan internal penolakan (tidak dikirim ke endpoint publik)."""
    rejection_remarks: Optional[str] = None
    reviewed_at: Optional[datetime] = None
