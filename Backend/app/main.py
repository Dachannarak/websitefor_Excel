import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import engine, Base, SessionLocal, UPLOAD_DIR
from .models import ConferenceEvent, UploadLog
from .routers import events, imports, uploads, reports, line_webhook

Base.metadata.create_all(bind=engine)

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
app.include_router(uploads.router)
app.include_router(reports.router)
app.include_router(line_webhook.router)

@app.get("/")
def root():
    return {"message": "Conference API Running 🌿"}
