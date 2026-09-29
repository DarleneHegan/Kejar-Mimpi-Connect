"""
Router untuk pendaftaran peserta event (publik, tanpa akun) + laporan peserta (admin).
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.database import get_db
from api.models import Event, Registration, Admin
from api.schemas import RegistrationCreate, RegistrationConfirmOut, RegistrationListItem, RegistrationOut
from api.auth import get_current_admin
from api.utils import generate_qr_base64

router = APIRouter(prefix="/api", tags=["registrations"])


@router.post("/events/{event_id}/register", response_model=RegistrationConfirmOut, status_code=201)
def register_for_event(
    event_id: str, payload: RegistrationCreate, db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")
    if not event.is_published:
        raise HTTPException(status_code=400, detail="Event ini belum dipublish")

    if event.start_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Pendaftaran sudah ditutup, event telah berlalu")

    if event.quota:
        current_count = (
            db.query(func.count(Registration.id))
            .filter(Registration.event_id == event.id)
            .scalar()
            or 0
        )
        if current_count >= event.quota:
            raise HTTPException(status_code=400, detail="Kuota event sudah penuh")

    existing = (
        db.query(Registration)
        .filter(Registration.event_id == event_id, Registration.email == payload.email)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Email ini sudah terdaftar untuk event ini"
        )

    registration = Registration(
        event_id=event_id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    qr_base64 = generate_qr_base64(registration.ticket_token)

    return RegistrationConfirmOut(
        **RegistrationOut.model_validate(registration).model_dump(),
        qr_code_base64=qr_base64,
        event_title=event.title,
    )


@router.get("/registrations/{ticket_token}", response_model=RegistrationConfirmOut)
def get_registration_by_token(ticket_token: str, db: Session = Depends(get_db)):
    """Ambil ulang data konfirmasi + QR code berdasarkan ticket token (untuk halaman konfirmasi/reload)."""
    registration = (
        db.query(Registration).filter(Registration.ticket_token == ticket_token).first()
    )
    if not registration:
        raise HTTPException(status_code=404, detail="Tiket tidak ditemukan")

    event = db.query(Event).filter(Event.id == registration.event_id).first()
    qr_base64 = generate_qr_base64(registration.ticket_token)

    return RegistrationConfirmOut(
        **RegistrationOut.model_validate(registration).model_dump(),
        qr_code_base64=qr_base64,
        event_title=event.title if event else "",
    )


@router.get("/events/{event_id}/registrations", response_model=List[RegistrationListItem])
def list_registrations_for_event(
    event_id: str,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """List peserta terdaftar untuk sebuah event - khusus admin. Bisa search by nama/email."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")

    query = db.query(Registration).filter(Registration.event_id == event_id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Registration.full_name.ilike(like)) | (Registration.email.ilike(like))
        )
    query = query.order_by(Registration.created_at.asc())
    return query.all()
