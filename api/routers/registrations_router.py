"""
Router untuk pendaftaran peserta event (publik, tanpa akun) + laporan peserta (admin).
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.database import get_db
from api.models import Event, Registration, EventFormField, Admin
from api.schemas import (
    RegistrationCreate,
    RegistrationConfirmOut,
    RegistrationListItem,
    RegistrationOut,
    RegistrationApprovalResponse,
    BulkDecisionRequest,
    BulkDecisionResponse,
    RejectRequest,
)
from api.auth import get_current_admin
from api.utils import generate_qr_base64

router = APIRouter(prefix="/api", tags=["registrations"])


def _validate_custom_answers(event: Event, db: Session, answers: Optional[dict]) -> dict:
    """Validasi jawaban custom form field terhadap definisi field event (required, tipe opsi)."""
    answers = answers or {}
    fields = db.query(EventFormField).filter(EventFormField.event_id == event.id).all()
    cleaned = {}
    for field in fields:
        value = answers.get(field.id)
        if field.is_required and (value is None or value == "" or value == []):
            raise HTTPException(status_code=400, detail=f"Field '{field.label}' wajib diisi")
        if value is None or value == "":
            continue
        if field.field_type in {"dropdown", "radio"} and field.options and value not in field.options:
            raise HTTPException(status_code=400, detail=f"Pilihan untuk '{field.label}' tidak valid")
        if field.field_type == "checkbox" and field.options:
            selected = value if isinstance(value, list) else [value]
            invalid = [v for v in selected if v not in field.options]
            if invalid:
                raise HTTPException(status_code=400, detail=f"Pilihan untuk '{field.label}' tidak valid")
        cleaned[field.id] = value
    return cleaned


@router.post("/events/{event_id}/register", response_model=RegistrationConfirmOut, status_code=201)
def register_for_event(
    event_id: str, payload: RegistrationCreate, db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")
    if not event.is_published:
        raise HTTPException(status_code=400, detail="Event ini belum dipublish")
    if event.is_closed:
        raise HTTPException(status_code=400, detail="Pendaftaran event ini sudah ditutup")

    if event.start_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Pendaftaran sudah ditutup, event telah berlalu")

    if event.quota:
        # Hitung pending + confirmed supaya tidak over-booking saat masih menunggu approval.
        current_count = (
            db.query(func.count(Registration.id))
            .filter(Registration.event_id == event.id, Registration.status.in_(["pending", "confirmed"]))
            .scalar()
            or 0
        )
        if current_count >= event.quota:
            raise HTTPException(status_code=400, detail="Kuota event sudah penuh")

    existing = (
        db.query(Registration)
        .filter(
            Registration.event_id == event_id,
            Registration.email == payload.email,
            Registration.status != "rejected",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Email ini sudah terdaftar untuk event ini"
        )

    cleaned_answers = _validate_custom_answers(event, db, payload.answers)

    status_value = "pending" if event.requires_approval else "confirmed"

    registration = Registration(
        event_id=event_id,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        custom_answers=cleaned_answers or None,
        status=status_value,
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    # QR tiket hanya digenerate untuk registrasi yang sudah confirmed (tidak butuh approval,
    # atau event tidak mewajibkan approval sama sekali).
    qr_base64 = generate_qr_base64(registration.ticket_token) if status_value == "confirmed" else None

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
    qr_base64 = generate_qr_base64(registration.ticket_token) if registration.status == "confirmed" else None

    return RegistrationConfirmOut(
        **RegistrationOut.model_validate(registration).model_dump(),
        qr_code_base64=qr_base64,
        event_title=event.title if event else "",
    )


@router.get("/events/{event_id}/registrations", response_model=List[RegistrationListItem])
def list_registrations_for_event(
    event_id: str,
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """List peserta terdaftar untuk sebuah event - khusus admin. Bisa search by nama/email, filter by status."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")

    query = db.query(Registration).filter(Registration.event_id == event_id)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Registration.full_name.ilike(like)) | (Registration.email.ilike(like))
        )
    if status:
        query = query.filter(Registration.status == status)
    query = query.order_by(Registration.created_at.asc())
    return query.all()


@router.patch("/registrations/{registration_id}/approve", response_model=RegistrationApprovalResponse)
def approve_registration(
    registration_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """
    Approve registrasi berstatus pending - khusus admin. Registrasi yang sebelumnya
    ditolak juga bisa di-approve ulang (hasil review ulang), selama kuota masih ada.
    """
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registrasi tidak ditemukan")
    if registration.status not in ("pending", "rejected"):
        raise HTTPException(status_code=400, detail=f"Registrasi ini sudah berstatus '{registration.status}', tidak bisa di-approve lagi")

    if registration.status == "rejected":
        # Registrasi rejected tidak dihitung ke kuota, jadi cek ulang sebelum diaktifkan lagi.
        event = db.query(Event).filter(Event.id == registration.event_id).first()
        if event and event.quota:
            used = (
                db.query(func.count(Registration.id))
                .filter(Registration.event_id == event.id, Registration.status.in_(["pending", "confirmed"]))
                .scalar()
                or 0
            )
            if used >= event.quota:
                raise HTTPException(status_code=400, detail="Kuota event sudah penuh, tidak bisa menyetujui ulang")

    registration.status = "confirmed"
    registration.rejection_remarks = None
    registration.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(registration)

    return RegistrationApprovalResponse(
        success=True,
        message=f"Pendaftaran '{registration.full_name}' telah disetujui",
        registration=RegistrationOut.model_validate(registration),
    )


@router.patch("/registrations/{registration_id}/reject", response_model=RegistrationApprovalResponse)
def reject_registration(
    registration_id: str,
    payload: RejectRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Tolak registrasi yang berstatus pending - khusus admin. Wajib menyertakan remarks (catatan internal)."""
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registrasi tidak ditemukan")
    if registration.status != "pending":
        raise HTTPException(status_code=400, detail=f"Registrasi ini sudah berstatus '{registration.status}', tidak bisa ditolak")
    remarks = payload.remarks.strip()
    if len(remarks) < 3:
        raise HTTPException(status_code=400, detail="Remarks alasan penolakan wajib diisi (minimal 3 karakter)")

    registration.status = "rejected"
    registration.rejection_remarks = remarks
    registration.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(registration)

    return RegistrationApprovalResponse(
        success=True,
        message=f"Pendaftaran '{registration.full_name}' telah ditolak",
        registration=RegistrationOut.model_validate(registration),
    )


@router.post("/registrations/bulk-decision", response_model=BulkDecisionResponse)
def bulk_decision(
    payload: BulkDecisionRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Approve/reject banyak registrasi sekaligus - khusus admin. Hanya registrasi berstatus pending yang diproses."""
    remarks = (payload.remarks or "").strip()
    if payload.action == "reject" and len(remarks) < 3:
        raise HTTPException(status_code=400, detail="Remarks alasan penolakan wajib diisi (minimal 3 karakter)")

    ids = list(dict.fromkeys(payload.registration_ids))
    registrations = (
        db.query(Registration)
        .filter(Registration.id.in_(ids), Registration.status == "pending")
        .all()
    )
    new_status = "confirmed" if payload.action == "approve" else "rejected"
    now = datetime.utcnow()
    for reg in registrations:
        reg.status = new_status
        reg.reviewed_at = now
        reg.rejection_remarks = remarks if payload.action == "reject" else None
    db.commit()

    processed = len(registrations)
    skipped = len(ids) - processed
    verb = "disetujui" if payload.action == "approve" else "ditolak"
    message = f"{processed} pendaftar {verb}"
    if skipped:
        message += f" ({skipped} dilewati karena sudah diproses)"
    return BulkDecisionResponse(success=True, message=message, processed=processed, skipped=skipped)
