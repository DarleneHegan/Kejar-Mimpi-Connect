"""
User management admin (invite). Semua endpoint khusus admin yang sudah login.
Admin baru tidak mendaftar sendiri; admin existing yang menambahkan, lalu admin
baru tinggal login dengan email/username + password yang diberikan.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Admin
from api.schemas import AdminCreate, AdminUpdate, AdminOut
from api.auth import get_current_admin, hash_password

router = APIRouter(prefix="/api/admins", tags=["admins"])


@router.get("", response_model=List[AdminOut])
def list_admins(db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    return db.query(Admin).order_by(Admin.created_at.asc()).all()


@router.post("", response_model=AdminOut, status_code=201)
def invite_admin(
    payload: AdminCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    email = payload.email.strip().lower()

    if db.query(Admin).filter(Admin.email == email).first():
        raise HTTPException(status_code=400, detail="Email ini sudah dipakai admin lain")

    new_admin = Admin(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin


@router.put("/{admin_id}", response_model=AdminOut)
def update_admin(
    admin_id: str,
    payload: AdminUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    target = db.query(Admin).filter(Admin.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin tidak ditemukan")

    email = payload.email.strip().lower()

    # Pastikan email tidak dipakai admin LAIN.
    if db.query(Admin).filter(Admin.email == email, Admin.id != admin_id).first():
        raise HTTPException(status_code=400, detail="Email ini sudah dipakai admin lain")

    target.name = payload.name.strip()
    target.email = email
    if payload.password:
        target.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(target)
    return target


@router.delete("/{admin_id}", status_code=204)
def delete_admin(
    admin_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    if admin_id == admin.id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")

    target = db.query(Admin).filter(Admin.id == admin_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Admin tidak ditemukan")

    # Jangan sampai sistem kehilangan semua admin.
    if db.query(Admin).count() <= 1:
        raise HTTPException(status_code=400, detail="Minimal harus ada satu admin")

    db.delete(target)
    db.commit()
    return None
