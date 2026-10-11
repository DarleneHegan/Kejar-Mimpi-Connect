"""
Model database: Admin, Event, Registration, EventFormField.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, Integer, JSON
from sqlalchemy.orm import relationship

from api.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Admin(Base):
    __tablename__ = "admins"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    category = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    quota = Column(Integer, nullable=True)  # kosong = tanpa batas
    is_published = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=False, nullable=False)
    # Ditutup: event tetap tampil di daftar publik, tapi pendaftaran tidak dibuka lagi.
    is_closed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    registrations = relationship(
        "Registration", back_populates="event", cascade="all, delete-orphan"
    )
    form_fields = relationship(
        "EventFormField",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventFormField.order",
    )


class EventFormField(Base):
    """Definisi field custom pada form pendaftaran suatu event (mirip Google Form)."""

    __tablename__ = "event_form_fields"

    id = Column(String, primary_key=True, default=gen_uuid)
    event_id = Column(String, ForeignKey("events.id"), nullable=False, index=True)
    label = Column(String, nullable=False)
    field_type = Column(String, nullable=False, default="text")  # text|number|email|phone|textarea|dropdown|radio|checkbox
    options = Column(JSON, nullable=True)  # list[str], dipakai untuk dropdown/radio/checkbox
    is_required = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="form_fields")


class Registration(Base):
    __tablename__ = "registrations"

    id = Column(String, primary_key=True, default=gen_uuid)
    event_id = Column(String, ForeignKey("events.id"), nullable=False, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True)
    custom_answers = Column(JSON, nullable=True)  # {field_id: jawaban}
    ticket_token = Column(String, unique=True, nullable=False, index=True, default=gen_uuid)
    status = Column(String, nullable=False, default="confirmed")  # pending|confirmed|rejected
    rejection_remarks = Column(Text, nullable=True)  # catatan internal admin, tidak ditampilkan ke peserta
    reviewed_at = Column(DateTime, nullable=True)
    is_checked_in = Column(Boolean, default=False)
    checked_in_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    event = relationship("Event", back_populates="registrations")


class Organizer(Base):
    """Anggota organizer komunitas, ditampilkan di halaman About publik."""

    __tablename__ = "organizers"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # misal: Lead Organizer
    affiliation = Column(String, nullable=True)  # instansi/perusahaan
    photo_url = Column(Text, nullable=True)  # data URL gambar hasil crop (base64)
    bio = Column(Text, nullable=True)
    links = Column(JSON, nullable=True)  # [{"label": "LinkedIn", "url": "https://..."}]
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
