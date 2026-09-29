"""
Koneksi database SQLAlchemy ke Supabase Postgres.
DATABASE_URL diambil dari environment variable (lihat .env.example).
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_dev.db")

# Supabase Postgres butuh sslmode=require untuk koneksi eksternal.
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if DATABASE_URL.startswith("postgresql"):
    if "sslmode" not in DATABASE_URL:
        DATABASE_URL += ("&" if "?" in DATABASE_URL else "?") + "sslmode=require"
    # Serverless (Vercel) butuh pool kecil dan tidak menyimpan koneksi lama.
    engine_kwargs.update({"pool_size": 1, "max_overflow": 2, "pool_recycle": 300})
elif DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
