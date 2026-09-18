import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from ..database import get_db
from ..file_utils import read_capped as _read_capped
from ..models import ConferenceEvent, UploadLog
from ..schemas import ImportResultOut
from ..services.conference_service import process_conference_excel

router = APIRouter(prefix="/api/v1", tags=["Import"])

_MAX_EXCEL_BYTES = 20 * 1024 * 1024   # 20 MB
_XLSX_MAGIC      = b"PK\x03\x04"      # ZIP-based (.xlsx)
_XLS_MAGIC       = b"\xD0\xCF\x11\xE0"  # BIFF8 (.xls)
_COMPARE_FIELDS = [
    "location", "app", "coordinator", "department",
    "book_no", "status", "assignee", "zoom_user",
    "details", "month_source",
]


def _diff_fields(old_row, new_ev: dict) -> list[dict]:
    """เทียบฟิลด์ระหว่างของเดิมกับของใหม่ คืน list ของฟิลด์ที่เปลี่ยนจริง"""
    diffs = []
    for f in _COMPARE_FIELDS:
        old_val = getattr(old_row, f, "") or ""
        new_val = new_ev.get(f, "") or ""
        if str(old_val).strip() != str(new_val).strip():
            diffs.append({"field": f, "old": str(old_val), "new": str(new_val)})
    return diffs






def _row_key(d: dict) -> tuple:
    # date + time_raw + title ลดโอกาสชนกันของสองรายการที่ชื่อซ้ำกันในวันเดียวกัน
    # (เช่น ประชุมประจำสัปดาห์ชื่อเดียวกันแต่คนละช่วงเวลา) เทียบกับใช้แค่ date+title
    return (d["date"], (d.get("time_raw") or "").strip(), (d["title"] or "").strip())


def _existing_excel_events(db: Session) -> dict[tuple, list]:
    """แผนที่ key(date+time_raw+title) -> รายการ ConferenceEvent ที่มาจาก source='excel'
    ใช้ร่วมกันทั้งตอน preview และตอน upsert จริง เพื่อให้ผลลัพธ์ new/update ตรงกันเสมอ"""
    existing: dict[tuple, list] = defaultdict(list)
    query = db.query(ConferenceEvent).filter(ConferenceEvent.source == "excel").order_by(ConferenceEvent.id)
    for e in query.all():
        existing[_row_key({"date": e.date, "time_raw": e.time_raw, "title": e.title})].append(e)
    return existing


def _upsert_events(events: list[dict], db: Session) -> tuple[int, int]:
    """Upsert เฉพาะ source='excel' — ไม่แตะ manual events
    ถ้า key ซ้ำ (date+time_raw+title) → update ด้วยข้อมูลใหม่
    หมายเหตุ: ถ้ามีของเดิมมากกว่ารายการใหม่ที่ key เดียวกัน จะ "เหลือของเดิมไว้เฉยๆ" ไม่ลบทิ้ง —
    เพราะ key (date+time_raw+title) ไม่การันตีว่าเป็นรายการเดียวกันจริงเสมอไป การลบอัตโนมัติเคยทำให้
    ข้อมูลที่ไม่เกี่ยวข้องกันแต่บังเอิญ key ชนกันหายไปโดยไม่ตั้งใจ
    ไม่ commit ที่นี่ — caller รับผิดชอบ commit เพื่อให้ events + UploadLog อยู่ใน transaction เดียว"""
    existing = _existing_excel_events(db)

    added = updated = 0
    for ev in events:
        key = _row_key(ev)
        bucket = existing.get(key)
        if bucket:
            row = bucket.pop()
            for k, v in ev.items():
                setattr(row, k, v)
            row.deleted_at = None  # ป้องกันรายการที่ถูกลบไว้ก่อนกลับมาโผล่แบบยังลบอยู่หลัง re-import
            updated += 1
        else:
            db.add(ConferenceEvent(**ev, source="excel"))
            added += 1

    return added, updated

import base64
import hashlib
import json
import re
import time
from pathlib import Path

from ..schemas import PreviewResultOut, PreviewRowOut

# เก็บบน disk (ไม่ใช่ dict ในหน่วยความจำ) เพราะถ้า uvicorn รันหลาย worker
# แต่ละ worker จะมี memory แยกกัน — preview ที่สร้างที่ worker หนึ่งจะหาไม่เจอที่อีก worker
_PREVIEW_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "preview_cache"
_PREVIEW_TTL_SECONDS = 300
_TOKEN_RE = re.compile(r"^[a-f0-9]{16}$")

def _make_preview_token(contents: bytes) -> str:
    return hashlib.sha256(contents + str(time.time()).encode()).hexdigest()[:16]

def _preview_path(token: str) -> Path:
    # token มาจาก client เสมอ (query param ของ /import-excel) — ต้องตรวจรูปแบบก่อนต่อ path
    # กันไม่ให้ traversal (../) หลุดออกนอก _PREVIEW_CACHE_DIR ได้
    if not _TOKEN_RE.match(token):
        raise HTTPException(status_code=400, detail="Preview token ไม่ถูกต้อง")
    return _PREVIEW_CACHE_DIR / f"{token}.json"

def _save_preview(token: str, data: dict) -> None:
    _PREVIEW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {**data, "contents": base64.b64encode(data["contents"]).decode("ascii")}
    with open(_preview_path(token), "w", encoding="utf-8") as f:
        json.dump(payload, f)

def _load_preview(token: str) -> dict | None:
    path = _preview_path(token)
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
        payload["contents"] = base64.b64decode(payload["contents"])
    except (json.JSONDecodeError, KeyError, ValueError):
        # ไฟล์ cache เขียนไม่สมบูรณ์/เสียหาย — ถือว่า preview หมดอายุแล้ว
        _delete_preview(token)
        return None
    return payload

def _delete_preview(token: str) -> None:
    _preview_path(token).unlink(missing_ok=True)

def _cleanup_expired_previews():
    if not _PREVIEW_CACHE_DIR.exists():
        return
    now = time.time()
    for path in _PREVIEW_CACHE_DIR.glob("*.json"):
        if now - path.stat().st_mtime > _PREVIEW_TTL_SECONDS:
            path.unlink(missing_ok=True)

@router.post("/preview-excel", response_model=PreviewResultOut)
async def preview_excel(
    file: UploadFile = File(...),
    db:   Session   = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="กรุณาอับโหลดไฟล์ Excel เท่านั้น (.xlsx / .xls)")

    contents = await _read_capped(file, _MAX_EXCEL_BYTES, "ไฟล์ใหญ่ไม่เกิน 20 MB")
    if not contents:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")

    if not (contents[:4] == _XLSX_MAGIC or contents[:4] == _XLS_MAGIC):
        raise HTTPException(status_code=400, detail="ไฟล์ไม่ใช่ Excel จริง (magic bytes ไม่ตรง)")

    try:
        result = await run_in_threadpool(process_conference_excel, contents)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"อ่านไฟล์ไม่สำเร็จ: {str(e)}")

    events         = result["events"]
    skipped_rows   = result["skipped_rows"] 
    skipped_sheets = result["skipped_sheets"]

    if not events:
        raise HTTPException(status_code=422, detail="ไม่พบข้อมูลในไฟล์ - ตรวจสอบ format ของ Excel")

    #เทียบข้อมูลเดิมโดยไม่ต้องบันทึก - logic เดียวกับ _upsert_events
    existing = _existing_excel_events(db)

    new_rows: list[dict]    = []
    update_rows: list[dict] = []
    unchanged_rows: list[dict] = []

    for ev in events:
            key = _row_key(ev)
            row_preview = {
                "date": ev["date"], "time_raw": ev.get("time_raw") or "",
                "title": ev["title"], "status": "", "reason":"", "diffs": [],
            }
            bucket = existing.get(key)
            if bucket:
                old_row = bucket.pop()  # pop เหมือน _upsert_events เพื่อให้ผลลัพธ์ preview/upsert จริงตรงกันเสมอเวลามีคีย์ซ้ำ
                diffs = _diff_fields(old_row, ev)
                if diffs:
                    row_preview["status"] = "update"
                    row_preview["diffs"] = diffs
                    update_rows.append(row_preview)
                else:
                    row_preview["status"] = "unchanged"
                    unchanged_rows.append(row_preview)
            else:
                row_preview["status"] = "new"
                new_rows.append(row_preview)
                        
    _cleanup_expired_previews()
    token = _make_preview_token(contents)
    _save_preview(token, {
        "contents": contents,
        "filename": file.filename,
        "created_at": time.time(),
    })

    sheets = sorted(set(e["month_source"] for e in events))

    #ไฟล์นี้เคยอับโหลดมาแล้ว ถ้าไม่มีรายการใหม่/อัปเดตเลย
    #แต่ถ้ามีรายการ unchanged  อยู่ (กันเคส false positive ตอนไฟล์แรกที่ยังไม่มีข้อมูลเดิม)
    is_dup = len(events) > 0 and len(new_rows) == 0 and len(update_rows) == 0 and len(unchanged_rows) > 0

    return PreviewResultOut(
        total_rows=len(events),
        new_count=len(new_rows),
        update_count=len(update_rows),
        unchanged_count=len(unchanged_rows),
        invalid_count=skipped_rows,
        sheets=sheets,
        skipped_rows=skipped_rows,
        skipped_sheets=skipped_sheets,
        sample_new=[PreviewRowOut(**r) for r in new_rows[:5]],
        sample_update=[PreviewRowOut(**r) for r in update_rows[:5]],
        is_likely_duplicate_file=is_dup,
        preview_token=token,
    )

from typing import Optional

@router.post("/import-excel", response_model=ImportResultOut)
async def import_excel(
    file:  Optional[UploadFile]  = File(None),
    token: Optional[str]         = None,
    db:    Session               = Depends(get_db),
):
    if token:
        _cleanup_expired_previews()
        cached = _load_preview(token)
        if not cached:
            raise HTTPException(status_code=410, detail="Preview หมดอายุแล้ว กรุณาอัปโหลดไฟล์ใหม่")
        contents = cached["contents"]
        filename = cached["filename"]
    else:
        if not file or not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
            raise HTTPException(status_code=400, detail="กรุณาอับโหลดไฟล์ excel เท่านั้น (.xlsx / .xls)")
        contents = await _read_capped(file, _MAX_EXCEL_BYTES, "ไฟล์ใหญ่เกิน 20 MB")
        filename = file.filename

    if not contents:
        raise HTTPException(status_code=400, detail="ไฟล์ว่างเปล่า")

    if not (contents[:4] == _XLSX_MAGIC or contents[:4] == _XLS_MAGIC):
        raise HTTPException(status_code=400, detail="ไฟล์ไม่ใช่ Excel จริง (magic bytes ไม่ตรง)")

    try:
        result = await run_in_threadpool(process_conference_excel, contents)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"อ่านไฟล์ไม่สำเร็จ: {str(e)}")

    events         = result["events"]
    skipped_rows   = result["skipped_rows"]
    skipped_sheets = result["skipped_sheets"]

    if not events:
        raise HTTPException(status_code=422, detail="ไม่พบข้อมูลในไฟล์ — ตรวจสอบ format ของ Excel")

    try:
        added, updated = _upsert_events(events, db)
        db.add(UploadLog(file_type="excel", filename=filename or "", records=added + updated))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("บันทึกลง DB ไม่สำเร็จระหว่าง import excel")
        raise HTTPException(status_code=500, detail="บันทึกลง DB ไม่สำเร็จ — กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ")

    if token:
        _delete_preview(token)

    sheets  = sorted(set(e["month_source"] for e in events))
    message = f"นำเข้าสำเร็จ — เพิ่มใหม่ {added} รายการ, อัปเดต {updated} รายการ จาก {len(sheets)} เดือน"
    if skipped_rows:
        message += f" (ข้าม {skipped_rows} แถวที่วันที่ไม่ถูกต้อง)"
    if skipped_sheets:
        message += f" (ข้ามชีท {', '.join(skipped_sheets)})"

    return ImportResultOut(
        success=True,
        message=message,
        total_records=added + updated,
        sheets=sheets,
        skipped_rows=skipped_rows,
        skipped_sheets=skipped_sheets,
    )



@router.get("/check-duplicates")
def check_duplicates(db: Session = Depends(get_db)):
    """เช็คว่ามีข้อมูลซ้ำหลงเหลืออยู่ใน DB ไหม (ซ้ำกัน)"""
    from sqlalchemy import func

    dup_groups = (
        db.query(
            ConferenceEvent.date,
            ConferenceEvent.time_raw,
            ConferenceEvent.title,
            func.count(ConferenceEvent.id).label("cnt"),
        )
        .filter(ConferenceEvent.source == "excel")
        .group_by(ConferenceEvent.date, ConferenceEvent.time_raw, ConferenceEvent.title)
        .having(func.count(ConferenceEvent.id) > 1)
        .all()
    )
    
    groups = [
        {
            "date": g.date,
            "time_raw": g.time_raw,
            "title": g.title,
            "count": g.cnt,
            "excess": g.cnt - 1,
        }
        for g in dup_groups
    ]
    
    return {
        "has_duplicates": len(groups) > 0,
        "duplicate_groups": len(groups),
        "excess_rows": sum(g["excess"] for g in groups),
        "details": groups,
    }



@router.get("/upload-stats")
def get_upload_stats(db: Session = Depends(get_db)):
    excel_count = db.query(UploadLog).filter(UploadLog.file_type == "excel").count()
    last = db.query(UploadLog).order_by(UploadLog.uploaded_at.desc()).first()
    return {
        "excel": excel_count,
        "last_uploaded_at": last.uploaded_at.isoformat() if last else None,
    }
