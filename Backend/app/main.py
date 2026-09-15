import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func

from .database import engine, Base, SessionLocal, UPLOAD_DIR
from .models import ConferenceEvent
from .routers import events, imports, reports, line_webhook

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)


def _warn_if_dates_not_migrated_to_be():
    """เช็คตอน startup ว่ายังมีแถวที่ date เป็น ค.ศ. (ไม่ใช่ พ.ศ.) หลงเหลืออยู่ไหม
    ป้องกันปัญหา reports/exports คืนค่าว่างเปล่าแบบไม่มี error แจ้งเตือน เพราะลืมรัน
    Backend/migrations/001_migrate_year_to_be.py ตอน deploy
    date เก็บเป็น string "YYYY-MM-DD" ปีเต็ม 4 หลักเสมอ จึงเทียบ prefix แบบ string ได้ตรงกับตัวเลข
    """
    db = SessionLocal()
    try:
        unmigrated = (
            db.query(func.count(ConferenceEvent.id))
            .filter(ConferenceEvent.date.isnot(None), ConferenceEvent.date != "")
            .filter(func.substr(ConferenceEvent.date, 1, 4) < "2400")
            .scalar()
        )
        if unmigrated:
            logger.warning(
                "พบ %d แถวใน conference_events ที่ date ยังเป็น ค.ศ. (ไม่ใช่ พ.ศ.) — "
                "reports/reports export ที่กรองปีแบบ พ.ศ. จะคืนค่าผิด/ว่างเปล่าสำหรับแถวเหล่านี้ "
                "โปรดรัน Backend/migrations/001_migrate_year_to_be.py",
                unmigrated,
            )
    finally:
        db.close()


_warn_if_dates_not_migrated_to_be()

app = FastAPI(
    title="Conference Schedule API",
    description="ระบบจัดการตาราง Video Conference กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช",
    version="1.0.0",
)

# ระบุ origin ที่อนุญาตผ่าน .env (คั่นด้วย comma) แทนการเปิดกว้างด้วย "*"
# ดีฟอลต์ครอบคลุมแค่ dev server ของ Vite เพื่อไม่ให้ของเดิมพังตอน dev
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in _allowed_origins if origin.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Results-Truncated"],
)

UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(events.router)
app.include_router(imports.router)
app.include_router(reports.router)
app.include_router(line_webhook.router)

@app.get("/")
def root():
    return {"message": "Conference API Running 🌿"}
