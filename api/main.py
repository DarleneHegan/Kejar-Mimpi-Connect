"""
Entry point FastAPI. Dijalankan lokal via uvicorn, atau di Vercel via Mangum adapter.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from api.database import Base, engine
from api.routers import auth_router, events_router, registrations_router, checkin_router

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
app.include_router(registrations_router.router)
app.include_router(checkin_router.router)


@app.on_event("startup")
def on_startup():
    # Membuat tabel otomatis jika belum ada (aman dipanggil berulang kali).
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Adapter untuk Vercel serverless function
handler = Mangum(app)
