from fastapi import APIRouter, UploadFile, File, HTTPException

from ..file_utils import read_capped
from ..services.image_service import _ALLOWED_EXT, is_image, save_image_bytes

router = APIRouter(prefix="/api/v1", tags=["Upload"])

_ALLOWED    = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_BYTES  = 10 * 1024 * 1024  # 10 MB


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in _ALLOWED:
        raise HTTPException(status_code=400, detail="กรุณาอัปโหลดรูปภาพ (JPEG / PNG / WebP)")

    contents = await read_capped(file, _MAX_BYTES, "ไฟล์ใหญ่เกิน 10 MB")
    if not contents:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")
    # Content-Type header is client-controlled and spoofable — verify actual
    # file bytes too, same defense already used for Excel uploads.
    if not is_image(contents):
        raise HTTPException(status_code=400, detail="ไฟล์ไม่ใช่รูปภาพจริง (magic bytes ไม่ตรง)")

    parts = (file.filename or "").rsplit(".", 1)
    ext   = ("." + parts[-1].lower()) if len(parts) == 2 else ".jpg"
    if ext not in _ALLOWED_EXT:
        ext = ".jpg"  # นามสกุลไม่อยู่ใน allowlist — เนื้อไฟล์ตรวจแล้วว่าเป็นรูปจริง แต่กันไม่ให้ extension เพี้ยนไปทำให้ static file server ตีความ content-type ผิด
    filename = save_image_bytes(contents, ext)

    return {"url": f"/uploads/{filename}"}
