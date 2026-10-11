"""
Router organizer komunitas.
- GET publik: daftar organizer untuk halaman About
- POST/PUT/DELETE: admin only
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Organizer, Admin
from api.schemas import OrganizerCreate, OrganizerOut
from api.auth import get_current_admin

router = APIRouter(prefix="/api/organizers", tags=["organizers"])


def _to_db_dict(payload: OrganizerCreate) -> dict:
    data = payload.model_dump()
    data["links"] = [link for link in data["links"]]
    return data


@router.get("", response_model=List[OrganizerOut])
def list_organizers(db: Session = Depends(get_db)):
    return db.query(Organizer).order_by(Organizer.order.asc(), Organizer.created_at.asc()).all()


@router.post("", response_model=OrganizerOut, status_code=201)
def create_organizer(
    payload: OrganizerCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    organizer = Organizer(**_to_db_dict(payload))
    db.add(organizer)
    db.commit()
    db.refresh(organizer)
    return organizer


@router.put("/{organizer_id}", response_model=OrganizerOut)
def update_organizer(
    organizer_id: str,
    payload: OrganizerCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    organizer = db.query(Organizer).filter(Organizer.id == organizer_id).first()
    if not organizer:
        raise HTTPException(status_code=404, detail="Organizer tidak ditemukan")
    for key, value in _to_db_dict(payload).items():
        setattr(organizer, key, value)
    db.commit()
    db.refresh(organizer)
    return organizer


@router.delete("/{organizer_id}", status_code=204)
def delete_organizer(
    organizer_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    organizer = db.query(Organizer).filter(Organizer.id == organizer_id).first()
    if not organizer:
        raise HTTPException(status_code=404, detail="Organizer tidak ditemukan")
    db.delete(organizer)
    db.commit()
    return None
