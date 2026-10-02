"""
Router untuk form builder: admin mengatur field-field custom pada form pendaftaran
suatu event (mirip Google Form). Publik bisa membaca definisi field untuk menampilkan
form pendaftaran dinamis.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Event, EventFormField, Admin
from api.schemas import EventFormFieldOut, EventFormFieldsReplaceRequest
from api.auth import get_current_admin

router = APIRouter(prefix="/api/events", tags=["form-fields"])


def _validate_fields(fields_payload):
    for f in fields_payload:
        try:
            f.validate_type()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))


@router.get("/{event_id}/form-fields", response_model=List[EventFormFieldOut])
def list_form_fields(event_id: str, db: Session = Depends(get_db)):
    """Ambil definisi field form pendaftaran suatu event - publik (dipakai untuk render form dinamis)."""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")
    return (
        db.query(EventFormField)
        .filter(EventFormField.event_id == event_id)
        .order_by(EventFormField.order.asc())
        .all()
    )


@router.put("/{event_id}/form-fields", response_model=List[EventFormFieldOut])
def replace_form_fields(
    event_id: str,
    payload: EventFormFieldsReplaceRequest,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    """
    Simpan ulang seluruh daftar field form pendaftaran sebuah event sekaligus (replace all).
    Dipakai oleh form builder admin: setiap kali admin menyimpan susunan field, seluruh field
    lama dihapus dan diganti dengan daftar baru sesuai urutan yang dikirim.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")

    _validate_fields(payload.fields)

    db.query(EventFormField).filter(EventFormField.event_id == event_id).delete()

    new_fields = []
    for idx, f in enumerate(payload.fields):
        field = EventFormField(
            event_id=event_id,
            label=f.label,
            field_type=f.field_type,
            options=f.options,
            is_required=f.is_required,
            order=f.order if f.order else idx,
        )
        db.add(field)
        new_fields.append(field)

    db.commit()
    for field in new_fields:
        db.refresh(field)
    return new_fields
