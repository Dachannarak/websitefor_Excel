from typing import Any
from pydantic import BaseModel, field_validator
from datetime import datetime


class ConferenceEventOut(BaseModel):
    """Schema ที่ส่งออกให้ Frontend"""
    id:           int
    date:         str
    time_raw:     str
    title:        str
    location:     str
    app:          str
    coordinator:  str
    department:   str
    book_no:      str
    status:       str
    assignee:     str
    zoom_user:    str
    details:      str
    month_source: str
    source:       str = "manual"
    image_url:    str = ""
    meeting_link:  str = ""
    event_type:   str = ""
    imported_at:  datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator(
        "date", "time_raw", "location", "app", "coordinator", "department",
        "book_no", "status", "assignee", "zoom_user", "details", "month_source",
        "source", "image_url", "meeting_link", "event_type",
        mode="before",
    )
    @classmethod
    def null_to_empty(cls, v: Any) -> str:
        return "" if v is None else v

class FieldDiffOut(BaseModel):
    field: str
    old:   str
    new:   str

class PreviewRowOut(BaseModel):
    """แถวตัวอย่างสำหรับแสดงใน Preview"""
    date:     str
    time_raw: str
    title:    str
    status:   str
    reason:   str = ""
    diffs:    list[FieldDiffOut] = []    

class PreviewResultOut(BaseModel):
    """Schema สำหรับ preview ก่อน import จริง"""
    total_rows:     int
    new_count:      int
    update_count:   int
    unchanged_count:int = 0
    invalid_count:  int
    sheets:         list[str]
    skipped_rows:   int = 0
    skipped_sheets: list[str] = []
    sample_new:     list[PreviewRowOut] = []
    sample_update:  list[PreviewRowOut] = []
    is_likely_duplicate_file: bool = False
    preview_token:  str
      
class ImportResultOut(BaseModel):
    """Schema ที่ส่งกลับหลัง import Excel สำเร็จ"""
    success:        bool
    message:        str
    total_records:  int
    sheets:         list[str]
    skipped_rows:   int = 0
    skipped_sheets: list[str] = []
