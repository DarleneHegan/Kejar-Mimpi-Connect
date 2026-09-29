"""
Script untuk membuat tabel database & akun admin pertama.
Jalankan sekali secara manual (bukan bagian dari API request):

    python -m api.seed_admin

Kredensial admin diambil dari environment variable ADMIN_EMAIL / ADMIN_PASSWORD
(lihat .env.example).
"""
import os
from dotenv import load_dotenv

load_dotenv()

from api.database import Base, engine, SessionLocal  # noqa: E402
from api.models import Admin  # noqa: E402
from api.auth import hash_password  # noqa: E402


def main():
    print("Membuat tabel database (jika belum ada)...")
    Base.metadata.create_all(bind=engine)

    email = os.getenv("ADMIN_EMAIL", "admin@example.com")
    password = os.getenv("ADMIN_PASSWORD", "admin123")
    name = os.getenv("ADMIN_NAME", "Admin")

    db = SessionLocal()
    try:
        existing = db.query(Admin).filter(Admin.email == email).first()
        if existing:
            print(f"Admin dengan email {email} sudah ada. Tidak membuat duplikat.")
            return

        admin = Admin(email=email, name=name, password_hash=hash_password(password))
        db.add(admin)
        db.commit()
        print(f"Admin berhasil dibuat: {email}")
        print("PENTING: segera login dan ganti password jika ini bukan environment lokal.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
