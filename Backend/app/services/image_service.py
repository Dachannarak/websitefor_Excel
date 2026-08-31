import uuid

from ..database import UPLOAD_DIR

_ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

_IMAGE_MAGIC = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"GIF87a", b"GIF89a")


def is_image(contents: bytes) -> bool:
    """ตรวจ magic bytes จริง — filename/extension เป็นค่าที่ผู้ใช้กำหนดเอง ปลอมได้"""
    if contents[:4] == b"RIFF" and contents[8:12] == b"WEBP":
        return True
    return any(contents.startswith(magic) for magic in _IMAGE_MAGIC)


def save_image_bytes(file_bytes: bytes, ext: str) -> str:
    """เขียนไฟล์รูปด้วยชื่อสุ่ม (UUID) ลง UPLOAD_DIR แล้วคืนชื่อไฟล์ที่บันทึก"""
    UPLOAD_DIR.mkdir(exist_ok=True)
    saved = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / saved).write_bytes(file_bytes)
    return saved


def process_conference_image(file_bytes: bytes, filename: str) -> dict:
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ".jpg"
    if ext not in _ALLOWED_EXT:
        raise ValueError(f"ไม่รองรับ format '{ext}' กรุณาใช้ .png / .jpg / .webp")
    if not is_image(file_bytes):
        raise ValueError("ไฟล์ไม่ใช่รูปภาพจริง (magic bytes ไม่ตรง)")

    saved = save_image_bytes(file_bytes, ext)

    return {
        "image_url":    f"/uploads/{saved}",
        "events":       [],
        "skipped_rows": 0,
        "skipped_sheets": [],
    }
