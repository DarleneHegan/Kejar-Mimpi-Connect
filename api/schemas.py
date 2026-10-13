"""
Pydantic schemas untuk request/response API.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_name: str


# ---------- Admin management (invite) ----------
class AdminCreate(BaseModel):
    # Dibuat fleksibel: cukup nama, email, dan password. Divalidasi ringan saja.
    name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=1, max_length=200)


class AdminUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    email: str = Field(..., min_length=3, max_length=200)
    # Kosongkan jika tidak ingin mengubah password
    password: Optional[str] = Field(default=None, max_length=200)


class AdminOut(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Event ----------
# Gambar event: hasil upload + crop di browser (data URL, maks ~2 MB),
# atau URL http(s) lama agar event yang sudah ada tetap valid.
EVENT_IMAGE_MAX = 2_800_000
EVENT_IMAGE_PATTERN = r"^(data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+|https?://\S+)$"

class EventBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=EVENT_IMAGE_MAX, pattern=EVENT_IMAGE_PATTERN)
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
    image_url: Optional[str] = Field(default=None, max_length=EVENT_IMAGE_MAX, pattern=EVENT_IMAGE_PATTERN)
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
    description: Optional[str] = Field(default=None, max_length=1000)
    show_description: bool = False
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
    # Form pendaftaran sepenuhnya custom: semua jawaban dikirim lewat `answers`.
    # full_name/email/phone opsional dan otomatis diturunkan dari jawaban di server.
    answers: Dict[str, Any] = Field(default_factory=dict)  # {field_id: jawaban}


class RegistrationOut(BaseModel):
    id: str
    event_id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
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


# ---------- Organizer ----------
class OrganizerLink(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    # Hanya http/https supaya link tidak bisa dipakai untuk javascript: URL
    url: str = Field(..., max_length=500, pattern=r"^https?://\S+$")


class OrganizerBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(..., min_length=2, max_length=100)
    affiliation: Optional[str] = Field(default=None, max_length=150)
    # Foto hasil upload + crop di browser, dikirim sebagai data URL gambar (maks ~1 MB).
    # Disimpan di database karena filesystem Vercel tidak persisten.
    photo_url: Optional[str] = Field(
        default=None,
        max_length=1_400_000,
        pattern=r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$",
    )
    bio: Optional[str] = Field(default=None, max_length=2000)
    links: List[OrganizerLink] = Field(default_factory=list, max_length=10)
    order: int = 0


class OrganizerCreate(OrganizerBase):
    pass


class OrganizerOut(OrganizerBase):
    id: str

    class Config:
        from_attributes = True
