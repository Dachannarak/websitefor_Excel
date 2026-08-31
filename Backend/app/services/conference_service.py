import io
from datetime import date
import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MONTH_TH_TO_NUM = {
    "มกราคม": 1, "กุมภาพันธ์": 2, "มีนาคม": 3, "เมษายน": 4,
    "พฤษภาคม": 5, "มิถุนายน": 6, "กรกฎาคม": 7, "สิงหาคม": 8,
    "กันยายน": 9, "ตุลาคม": 10, "พฤศจิกายน": 11, "ธันวาคม": 12,
}

EXCLUDED_SHEETS = {
    "จำนวน Conference",
    "ห้องประชุม",
    "รหัส User Zoom ใหม่ ",
    "Zoom_2569",
    "อุปกรณ์",
    "ประเภทตำแหน่งของบุคลากร ศทส.",
}

JUNK_TITLES = {"เรื่อง", "title", "-", "nan", "none", ""}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_str(val) -> str:
    """แปลงค่าใดๆ เป็น string สะอาด — คืน '' ถ้าว่างหรือ NaN"""
    if pd.isna(val):
        return ""
    cleaned = str(val).strip()
    if cleaned.lower() in {"nan", "none"}:
        return ""
    return cleaned


def _to_iso(year: int, month: int, day: int) -> str:
    """คืน YYYY-MM-DD ถ้าวันที่มีอยู่จริงในปฏิทินและปีอยู่ในช่วงที่สมเหตุสมผล — คืน '' ถ้าไม่มี (เช่น 31 เมษายน หรือปี 799)"""
    if not (1900 <= year <= 2200):
        return ""
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return ""


def parse_date(val) -> str:
    """
    แปลงวันที่หลากหลาย format ให้เป็น YYYY-MM-DD (คริสต์ศักราช)
    รองรับ:
      - pandas Timestamp / datetime
      - "1 ตุลาคม 2568"  (พ.ศ.)
      - "01/10/2568"
      - "2025-10-01"
    คืน "" ถ้าแปลงไม่ได้
    """
    if pd.isna(val):
        return ""

    # pandas Timestamp หรือ datetime
    if hasattr(val, "strftime"):
        year = val.year
        if year > 2400:
            year -= 543
        return _to_iso(year, val.month, val.day)

    raw = str(val).strip()

    # "1 ตุลาคม 2568" — รองรับข้อความนำหน้าด้วย เช่น "วันที่ 1 ตุลาคม 2568"
    for month_th, month_num in MONTH_TH_TO_NUM.items():
        if month_th in raw:
            tokens = raw.replace(month_th, f" {month_th} ").split()
            month_idx = tokens.index(month_th)
            if month_idx >= 1 and month_idx + 1 < len(tokens):
                try:
                    day = int(tokens[month_idx - 1])
                    year = int(tokens[month_idx + 1])
                    if year > 2400:
                        year -= 543
                    return _to_iso(year, month_num, day)
                except ValueError:
                    pass

    # "01/10/2568" หรือ "01/10/2025"
    if "/" in raw:
        parts = raw.split("/")
        if len(parts) == 3:
            try:
                day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                if year > 2400:
                    year -= 543
                return _to_iso(year, month, day)
            except ValueError:
                pass

    # ISO format "2025-10-01"
    try:
        parsed = pd.to_datetime(raw, errors="raise")
        year = parsed.year
        if year > 2400:
            year -= 543
        return _to_iso(year, parsed.month, parsed.day)
    except Exception:
        pass

    return ""


# ---------------------------------------------------------------------------
# Core processor
# ---------------------------------------------------------------------------

def process_conference_excel(file_bytes: bytes) -> dict:
    """
    รับ bytes ของไฟล์ Excel แล้วคืน
    {"events": [...], "skipped_rows": int, "skipped_sheets": [...]}
    """
    xls = pd.ExcelFile(io.BytesIO(file_bytes))
    all_events: list[dict] = []
    skipped_rows = 0
    skipped_sheets: list[str] = []

    for sheet_name in xls.sheet_names:

        if sheet_name in EXCLUDED_SHEETS:
            continue

        df = pd.read_excel(xls, sheet_name=sheet_name, skiprows=1)

        if len(df.columns) < 13:
            skipped_sheets.append(sheet_name)
            continue

        # ตรวจ header คร่าวๆ กันคอลัมน์เลื่อนตำแหน่งแบบเงียบๆ (เช่น มีคนแทรกคอลัมน์ใหม่)
        headers = [str(c) for c in df.columns[:13]]
        looks_like_date_col  = "วัน" in headers[1]
        looks_like_title_col = "เรื่อง" in headers[3] or "หัวข้อ" in headers[3]
        if not (looks_like_date_col and looks_like_title_col):
            skipped_sheets.append(sheet_name)
            continue

        df = df.iloc[:, :13].copy()
        df.columns = [
            "idx", "date_str", "time_str", "title", "location",
            "coordinator", "app", "department", "book_no",
            "status", "assignee", "zoom_user", "details",
        ]

        for _, row in df.iterrows():

            if pd.isna(row["date_str"]) or pd.isna(row["title"]):
                continue

            if "เดือน" in str(row["idx"]):
                continue

            if safe_str(row["title"]).lower() in JUNK_TITLES:
                continue

            date_iso = parse_date(row["date_str"])

            if not date_iso:
                skipped_rows += 1
                continue

            all_events.append({
                "month_source": sheet_name,
                "date":         date_iso,
                "time_raw":     safe_str(row["time_str"]),
                "title":        safe_str(row["title"]),
                "location":     safe_str(row["location"]),
                "app":          safe_str(row["app"]),
                "coordinator":  safe_str(row["coordinator"]),
                "department":   safe_str(row["department"]),
                "book_no":      safe_str(row["book_no"]),
                "status":       safe_str(row["status"]),
                "assignee":     safe_str(row["assignee"]),
                "zoom_user":    safe_str(row["zoom_user"]),
                "details":      safe_str(row["details"]),
            })

    # ลบแถวซ้ำภายในไฟล์เดียวกัน (date+time_raw+title ตรงกันเป๊ะ เช่น พิมพ์ซ้ำในชีท หรือซ้ำข้ามชีท)
    # เก็บแถวหลังสุดไว้ — กัน upsert พยายาม insert ซ้ำสอง key เดียวกันในทรานแซกชันเดียว
    # (key ต้องตรงกับ _row_key ใน routers/imports.py)
    dedup: dict[tuple, dict] = {}
    for ev in all_events:
        key = (ev["date"], ev["time_raw"].strip(), ev["title"].strip())
        dedup[key] = ev
    all_events = list(dedup.values())

    all_events.sort(key=lambda e: e["date"])
    return {
        "events": all_events,
        "skipped_rows": skipped_rows,
        "skipped_sheets": skipped_sheets,
    }