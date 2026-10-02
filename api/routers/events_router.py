"""
Router untuk CRUD event.
- List & detail event: publik (hanya event yang is_published=True untuk publik)
- Create/update/delete: admin only
"""
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from api.database import get_db
from api.models import Event, Registration, Admin, EventFormField
from api.schemas import EventCreate, EventUpdate, EventOut
from api.auth import get_current_admin

router = APIRouter(prefix="/api/events", tags=["events"])


def _to_event_out(event: Event, db: Session) -> EventOut:
    # registered_count = peserta yang sudah pasti ikut (confirmed), tidak termasuk pending/rejected.
    registered_count = (
        db.query(func.count(Registration.id))
        .filter(Registration.event_id == event.id, Registration.status == "confirmed")
        .scalar()
        or 0
    )
    pending_count = (
        db.query(func.count(Registration.id))
        .filter(Registration.event_id == event.id, Registration.status == "pending")
        .scalar()
        or 0
    )
    checked_in_count = (
        db.query(func.count(Registration.id))
        .filter(Registration.event_id == event.id, Registration.is_checked_in == True)  # noqa: E712
        .scalar()
        or 0
    )
    data = EventOut.model_validate(event)
    data.registered_count = registered_count
    data.checked_in_count = checked_in_count
    data.pending_count = pending_count
    return data


@router.get("", response_model=List[EventOut])
def list_events(
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_unpublished: bool = False,
    db: Session = Depends(get_db),
):
    """List event publik. include_unpublished hanya efektif jika dipanggil oleh admin (dicek di endpoint admin terpisah)."""
    query = db.query(Event)
    if not include_unpublished:
        query = query.filter(Event.is_published == True)  # noqa: E712
    if category:
        query = query.filter(Event.category == category)
    if search:
        like = f"%{search}%"
        query = query.filter(Event.title.ilike(like))
    query = query.order_by(Event.start_time.asc())
    events = query.all()
    return [_to_event_out(e, db) for e in events]


@router.get("/admin", response_model=List[EventOut])
def list_events_admin(
    db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)
):
    """List semua event (termasuk yang belum dipublish) - khusus admin."""
    events = db.query(Event).order_by(Event.start_time.desc()).all()
    return [_to_event_out(e, db) for e in events]


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")
    return _to_event_out(event, db)


@router.post("", response_model=EventOut, status_code=201)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    # Event baru selalu masuk sebagai draft; publikasi dilakukan terpisah dari daftar event.
    data = payload.model_dump()
    data["is_published"] = False
    data["is_closed"] = False
    event = Event(**data)
    db.add(event)
    db.commit()
    db.refresh(event)
    return _to_event_out(event, db)


@router.put("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")

    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("is_published") and not event.is_published:
        field_count = (
            db.query(func.count(EventFormField.id))
            .filter(EventFormField.event_id == event.id)
            .scalar()
            or 0
        )
        if field_count == 0:
            raise HTTPException(
                status_code=400,
                detail="Event belum bisa dipublikasikan: form pendaftaran minimal harus punya 1 pertanyaan",
            )
    for key, value in update_data.items():
        setattr(event, key, value)
    event.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(event)
    return _to_event_out(event, db)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event tidak ditemukan")
    db.delete(event)
    db.commit()
    return None
