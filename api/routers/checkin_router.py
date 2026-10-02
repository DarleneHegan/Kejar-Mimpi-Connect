"""
Router untuk absensi/check-in Hari-H (khusus admin/panitia).
Mendukung check-in via scan QR (ticket_token) dan pencarian manual nama/email.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Registration, Admin
from api.schemas import CheckInRequest, CheckInResponse, RegistrationOut
from api.auth import get_current_admin

router = APIRouter(prefix="/api/checkin", tags=["checkin"])


@router.post("", response_model=CheckInResponse)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    registration = (
        db.query(Registration)
        .filter(Registration.ticket_token == payload.ticket_token.strip())
        .first()
    )
    if not registration:
        return CheckInResponse(success=False, message="Tiket tidak ditemukan / tidak valid")

    if registration.status == "pending":
        return CheckInResponse(
            success=False,
            message=f"Pendaftaran '{registration.full_name}' masih menunggu approval admin, belum bisa check-in",
            registration=RegistrationOut.model_validate(registration),
        )
    if registration.status == "rejected":
        return CheckInResponse(
            success=False,
            message=f"Pendaftaran '{registration.full_name}' telah ditolak, tidak bisa check-in",
            registration=RegistrationOut.model_validate(registration),
        )

    if registration.is_checked_in:
        return CheckInResponse(
            success=False,
            message=f"Peserta '{registration.full_name}' sudah check-in sebelumnya pada "
            f"{registration.checked_in_at.strftime('%d-%m-%Y %H:%M') if registration.checked_in_at else '-'}",
            registration=RegistrationOut.model_validate(registration),
        )

    registration.is_checked_in = True
    registration.checked_in_at = datetime.utcnow()
    db.commit()
    db.refresh(registration)

    return CheckInResponse(
        success=True,
        message=f"Check-in berhasil untuk '{registration.full_name}'",
        registration=RegistrationOut.model_validate(registration),
    )


@router.post("/{registration_id}/manual", response_model=CheckInResponse)
def check_in_manual_by_id(
    registration_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """Check-in manual berdasarkan ID registrasi (dipakai saat admin cari nama dari daftar, bukan scan QR)."""
    registration = db.query(Registration).filter(Registration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=404, detail="Registrasi tidak ditemukan")

    if registration.status == "pending":
        return CheckInResponse(
            success=False,
            message=f"Pendaftaran '{registration.full_name}' masih menunggu approval admin, belum bisa check-in",
            registration=RegistrationOut.model_validate(registration),
        )
    if registration.status == "rejected":
        return CheckInResponse(
            success=False,
            message=f"Pendaftaran '{registration.full_name}' telah ditolak, tidak bisa check-in",
            registration=RegistrationOut.model_validate(registration),
        )

    if registration.is_checked_in:
        return CheckInResponse(
            success=False,
            message=f"Peserta '{registration.full_name}' sudah check-in sebelumnya",
            registration=RegistrationOut.model_validate(registration),
        )

    registration.is_checked_in = True
    registration.checked_in_at = datetime.utcnow()
    db.commit()
    db.refresh(registration)

    return CheckInResponse(
        success=True,
        message=f"Check-in berhasil untuk '{registration.full_name}'",
        registration=RegistrationOut.model_validate(registration),
    )
