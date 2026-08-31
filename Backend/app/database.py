import logging
import os
from pathlib import Path

import pymysql
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# path ตรงๆ อิงจากตำแหน่งไฟล์นี้ ไม่พึ่ง CWD ตอนรัน — ไม่งั้นถ้ารัน uvicorn จากคนละ directory
# จะหา .env ไม่เจอ (env vars อย่าง GEMINI_API_KEY จะดูเหมือน "ไม่พบ" ทั้งที่ไฟล์มีอยู่จริง)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME", "conference_db")

# Absolute path — independent of the process's current working directory,
# ที่ผ่านมาการใช้ "uploads" แบบ relative ทำให้ไฟล์ถูกเซฟ/เสิร์ฟคนละที่กันถ้ารัน uvicorn จากคนละ CWD
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


def _ensure_database() -> None:
    try:
        conn = pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        logging.error(
            "[database] เชื่อมต่อ/สร้างฐานข้อมูล '%s' ไม่สำเร็จ: %s — "
            "ตรวจสอบ DB_HOST/DB_PORT/DB_USER/DB_PASS ก่อนรันแอปอีกครั้ง",
            DB_NAME, exc,
        )
        raise


_ensure_database()

DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    "?charset=utf8mb4"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
