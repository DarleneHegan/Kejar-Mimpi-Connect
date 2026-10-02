"""
Entry point FastAPI. Dijalankan lokal via uvicorn, atau di Vercel via Mangum adapter.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from api.database import Base, engine
from api.routers import auth_router, events_router, registrations_router, checkin_router, form_fields_router

app = FastAPI(
    title="Sistem Absensi & Pendaftaran Event",
    description="API untuk publikasi event komunitas, pendaftaran peserta, dan absensi hari-H via QR code.",
    version="1.0.0",
)

# CORS dibuka untuk semua origin karena frontend static (HTML/JS) bisa diakses dari domain yang sama
# atau berbeda tergantung setup deployment. Sesuaikan allow_origins jika ingin dibatasi.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(events_router.router)
app.include_router(form_fields_router.router)
app.include_router(registrations_router.router)
app.include_router(checkin_router.router)


def _run_light_migrations():
    """
    Base.metadata.create_all() hanya membuat tabel baru, TIDAK menambah kolom baru
    ke tabel yang sudah ada. Fungsi ini menambahkan kolom-kolom baru (requires_approval,
    status, custom_answers) secara idempotent, aman dipanggil berulang kali baik di
    SQLite (dev) maupun Postgres (prod).
    """
    from sqlalchemy import text, inspect

    inspector = inspect(engine)
    is_sqlite = engine.url.get_backend_name() == "sqlite"

    statements = []
    if "events" in inspector.get_table_names():
        existing_cols = {c["name"] for c in inspector.get_columns("events")}
        bool_false = "0" if is_sqlite else "FALSE"
        if "requires_approval" not in existing_cols:
            statements.append(f"ALTER TABLE events ADD COLUMN requires_approval BOOLEAN DEFAULT {bool_false}")
        if "is_closed" not in existing_cols:
            statements.append(f"ALTER TABLE events ADD COLUMN is_closed BOOLEAN DEFAULT {bool_false}")

    if "registrations" in inspector.get_table_names():
        existing_cols = {c["name"] for c in inspector.get_columns("registrations")}
        if "status" not in existing_cols:
            statements.append("ALTER TABLE registrations ADD COLUMN status VARCHAR DEFAULT 'confirmed'")
        if "rejection_remarks" not in existing_cols:
            statements.append("ALTER TABLE registrations ADD COLUMN rejection_remarks TEXT")
        if "reviewed_at" not in existing_cols:
            col_type = "DATETIME" if is_sqlite else "TIMESTAMP"
            statements.append(f"ALTER TABLE registrations ADD COLUMN reviewed_at {col_type}")
        if "custom_answers" not in existing_cols:
            col_type = "TEXT" if is_sqlite else "JSON"
            statements.append(f"ALTER TABLE registrations ADD COLUMN custom_answers {col_type}")

    if statements:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))


@app.on_event("startup")
def on_startup():
    # Membuat tabel otomatis jika belum ada (aman dipanggil berulang kali).
    Base.metadata.create_all(bind=engine)
    _run_light_migrations()


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Adapter untuk Vercel serverless function
handler = Mangum(app)
