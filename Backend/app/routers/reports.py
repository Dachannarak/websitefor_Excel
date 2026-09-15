from datetime import date, datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import extract
from typing import Optional

from ..database import get_db
from ..models import ConferenceEvent
from ..services.conference_service import MONTH_TH_TO_NUM, be_to_ce_year, ce_to_be_year

router = APIRouter (prefix="/report", tags=["Reports"])

MONTHS_TH = {num: name for name, num in MONTH_TH_TO_NUM.items()}
DAYS_TH = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."]
DAY_FULL = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"]

DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']

def _weekday_idx(date_val) -> Optional[int]:
    """Sunday=0 ... Saturday=6 ตาม DAY_KEYS/DAY_FULL, คืน None ถ้า parse ไม่ได้
    date_val เป็นปี พ.ศ. เสมอ (ตรงกับที่เก็บใน DB หลัง migration) — ต้องแปลงเป็น ค.ศ.
    ก่อนคำนวณวันในสัปดาห์ เพราะ 543 ไม่ใช่ผลคูณของ 7
    """
    try:
        d = date.fromisoformat(str(date_val))
        return date(be_to_ce_year(d.year), d.month, d.day).isoweekday() % 7
    except (ValueError, TypeError):
        return None

def format_date_th(date_str: str, short=False) -> str:
    idx = _weekday_idx(date_str)
    if idx is None:
        return date_str
    d = date.fromisoformat(date_str)
    day = DAY_FULL[idx]
    month = MONTHS_TH[d.month]
    year = d.year  # d.year เป็น พ.ศ. อยู่แล้ว (ตรงกับที่เก็บใน DB)
    if short:
        return f"{d.day} {month[:3]}. {year}"
    return f"วัน{day}ที่ {d.day} {month} พ.ศ. {year}"

def _day_key(date_val) -> str:
    idx = _weekday_idx(date_val)
    return DAY_KEYS[idx] if idx is not None else ''

def _day_full(date_val) -> str:
    idx = _weekday_idx(date_val)
    return DAY_FULL[idx] if idx is not None else '-'

def _classify_status(status: str) -> str:
    s = (status or "").lower()
    if "ยกเลิก" in s or "cancel" in s: return "cancel"
    if "สร้าง link" in s or "link" in s: return "done"
    if "ย้าย" in s or "move" in s: return "moved"
    return "wait"

_STATUS_LABEL = {"done": "พร้อมแล้ว", "cancel": "ยกเลิก", "moved": "ย้ายวัน", "wait": "รอดำเนินการ"}

def get_status_label(status: str) -> str:
    return _STATUS_LABEL[_classify_status(status)]

def get_status_cls(status: str) -> str:
    return _classify_status(status)

def parse_time_range(time_raw: str):
    import re
    matches = re.findall(r'(\d{1,2})[.:](\d{2})', time_raw or "")
    def to_min(h, m): return int(h)*60 + int(m)
    if len(matches) >= 2:
        return to_min(*matches[0]), to_min(*matches[1])
    if len(matches) == 1:
        s = to_min(*matches[0])
        return s, s+60
    return 9*60, 10*60

def esc(s: str) -> str:
    return (s or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

# ===== COMPLETE FIX FOR report.py =====
_BASE_STYLE = """
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
*{font-family:'Sarabun','Noto Sans Thai',sans-serif!important}

/* ===== MAIN CONTAINER CENTER ===== */
body{
  font-size:11pt;
  color:#1a1a1a;
  background:#f0f0f0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  width:100%
}

.page{
  max-width:900px;
  width:100%;
  margin:0 auto;
  padding:40px 48px;
  background:#fff;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center
}

/* ===== CENTERING ALL SECTIONS ===== */
.hdr,
.section,
.table-card,
.gov-header,
.gov-signature,
.footer,
.chart-card,
.chart-card-formal,
header {
  width:100%;
  margin-left:auto;
  margin-right:auto;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center
}

/* Grid/Row centered */
.stats-grid,
.usage-row,
.kpi-row,
.kpi-row2,
.day-summary-row,
.insight-list {
  width:100%;
  margin:0 auto;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center
}

/* Table centered */
table {
  width:100%;
  margin:0 auto
}

/* ===== END OF CENTER FIX ===== */

.hdr{margin-bottom:24px;padding-bottom:20px;border-bottom:3px double #1B5E20}
.hdr-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.hdr-top > div:first-child{text-align:center}
.hdr-doc-no{font-size:8.5pt;color:#888}
.hdr h1{font-size:14pt;font-weight:800;color:#111}
.hdr p{font-size:10pt;color:#555;margin-top:3px}
.hdr h2{font-size:13pt;font-weight:700;color:#1B5E20;margin-top:14px}
.hdr h3{font-size:11pt;color:#333;font-weight:600;margin-top:5px}

.section{margin-bottom:26px}
.section-title{font-size:11.5pt;font-weight:800;color:#111;padding-bottom:6px;margin-bottom:14px;border-bottom:1.5px solid #1B5E20}
.section-num{color:#1B5E20;margin-right:4px}
.section-num-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#1B5E20;color:#fff;border-radius:4px;font-size:10pt;font-weight:800;margin-right:4px}
.day-summary-row{display:flex;gap:12px;margin:14px 0}
.day-total-box{display:flex;align-items:center;gap:8px;border:1px solid #ddd;border-radius:6px;padding:10px 16px;font-size:9.5pt;color:#333}
.day-total-icon{
  font-size:14px;flex-shrink:0;
  width:22px;height:22px;border-radius:50%;
  background:#1B5E20;display:inline-flex;align-items:center;justify-content:center;
}
.day-total-icon svg{width:13px;height:13px}
.day-peak-box{display:flex;align-items:center;gap:10px;background:#F0F5F1;border-radius:6px;padding:10px 16px;font-size:9.5pt;color:#333}
.day-peak-star{display:inline-flex;align-items:center;gap:4px;background:#1B5E20;color:#fff;padding:3px 10px;border-radius:4px;font-size:8.5pt;font-weight:700}
.day-yaxis-unit{font-size:7.5pt;color:#000;margin-bottom:6px}
.day-summary-table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:20px;border:1px solid #ddd}
.day-summary-table th{background:#F5F5F5;color:#333;padding:8px;font-weight:700;border:1px solid #ddd;text-align:center}
.day-summary-table td{padding:8px;border:1px solid #ddd;text-align:center;color:#333}
.day-summary-table td:first-child{text-align:left;font-weight:600;background:#FAFAFA}
.is-max-cell{color:#1B5E20;font-weight:800}
.day-note{font-size:8pt;color:#888;margin-top:8px}
.section-page-break{break-before:page;page-break-before:always}

.usage-row{display:flex;flex-direction:column;gap:32px;width:100%}
.usage-block{display:flex;flex-direction:column;align-items:center;width:100%}
.usage-block-divider{padding:24px;border:1px solid #e3e8e4;border-radius:14px;background:#fff;box-shadow:0 2px 10px rgba(27,94,32,.06)}
.usage-total-note{text-align:center;font-size:9pt;color:#888;margin-top:18px;padding-top:14px;border-top:1px dashed #ddd;width:100%}
.trend-header-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
.trend-subtitle{font-size:10pt;font-weight:700;color:#333}
.trend-chart-row{display:flex;gap:20px;align-items:flex-start}
.trend-chart-svg{flex:1;min-width:0}
.trend-legend{display:flex;flex-direction:column;gap:9px;flex-shrink:0;padding-top:8px}
.trend-legend-item{display:flex;align-items:center;gap:7px;font-size:9pt;color:#444}
.trend-legend-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.trend-table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:20px;border:1px solid #ddd;table-layout:fixed}
.trend-table th,.trend-table td{padding:8px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.trend-table th{background:#F5F5F5;font-weight:700;border:1px solid #ddd;text-align:center;color:#333}
.trend-table td{border:1px solid #ddd;text-align:center;color:#333}
.trend-table-app{text-align:left!important;font-weight:600}
.trend-table-total-row td{background:#F0F5F1;font-weight:700}

.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.kpi-box{padding:20px 12px;text-align:center;border-right:1px solid #F0F0F0;border-top:3px solid #1B5E20;background:linear-gradient(180deg,#fafdfb,#fff)}
.kpi-box:last-child{border-right:none}
.kpi-box .num{font-size:20pt;font-weight:800;color:#111}
.kpi-box .lbl{font-size:8.5pt;color:#555;margin-top:4px;font-weight:600}

.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}
.chart-card-formal{border:1px solid #c9c9c9!important;box-shadow:none!important;border-radius:6px!important;padding:32px 36px!important}
.chart-title{font-size:9.5pt;font-weight:700;color:#333;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #eee}
.chart-title2{font-size:9.5pt;font-weight:700;color:#333;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #eee;display:flex;align-items:center;gap:6px}
.chart-icon{font-size:10.5pt}
.chart-en{font-size:8pt;font-weight:600;color:#999;margin-left:2px}

.app-donut-row{display:flex;gap:24px;align-items:center;justify-content:center;width:100%;margin:0 auto}
.donut-pct{font-size:15pt;font-weight:800;color:#1B5E20;line-height:1.1}
.donut-lbl{font-size:7.5pt;color:#666;margin-top:4px}

.insight-list{display:flex;flex-direction:column;gap:16px}
.insight-item{display:flex;align-items:flex-start;gap:14px}
.insight-icon{flex-shrink:0;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10pt;font-weight:800;color:#fff}
.insight-icon svg{width:12px;height:12px}
.insight-good .insight-icon{background:#1B5E20}
.insight-info .insight-icon{background:#1565C0}
.insight-purple .insight-icon{background:#5E35B1}
.insight-title{font-size:9.5pt;font-weight:700;color:#222}
.insight-sub{font-size:8.5pt;color:#666;margin-top:2px;line-height:1.4}

.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;padding-bottom:9px;border-bottom:1px dotted #e0e0e0}
.bar-row:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.bar-label{font-size:9pt;width:110px;text-align:left;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#333;font-weight:600}
.bar-wrap{flex:1;background:#f2f2f2;border:1px solid #e5e5e5;border-radius:2px;height:14px;overflow:hidden}
.bar-fill{height:100%;background:#1B5E20}
.bar-count{font-size:9pt;color:#111;width:26px;flex-shrink:0;font-weight:700;text-align:right}
.app-mini-name{font-weight:600}
.app-mini-count{font-weight:700;color:#333}
.app-mini-empty{font-size:8.5pt;color:#999;text-align:center}
.app-summary-row{display:flex;gap:24px;align-items:center}
.app-highlight{flex:0 0 auto;text-align:center;padding-right:24px;border-right:1px solid #F0F0F0;min-width:160px}
.app-highlight-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;color:#fff;font-size:13pt;font-weight:800;margin-bottom:8px}
.app-highlight-pct{font-size:26pt;font-weight:800;color:#1B5E20;line-height:1}
.app-highlight-label{font-size:8.5pt;color:#666;margin-top:8px;line-height:1.4}
.app-mini-list{flex:1;display:flex;flex-direction:column;width:100%;max-width:520px;margin:0 auto}
.mini-list-heading{display:flex;justify-content:space-between;align-items:baseline;border-top:1px dashed #ccc;padding-top:20px;margin-top:8px;margin-bottom:16px}
.mini-list-heading-title{font-size:13px;font-weight:700;color:#1B5E20}
.mini-list-heading-unit{font-size:12px;color:#000}
.app-mini-row2{display:flex;align-items:center;gap:12px;width:100%;margin-bottom:16px}
.app-mini-dot{flex:0 0 10px;width:10px;height:10px;border-radius:50%}
.app-mini-icon{flex:0 0 22px;width:22px;height:22px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
.app-mini-name{flex:0 0 100px;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.app-mini-bar{flex:1 1 auto;min-width:30px;height:8px!important}
.app-mini-pct{flex:0 0 40px;text-align:right;font-weight:700;font-size:13px}
.app-mini-count{flex:0 0 65px;text-align:right;font-size:12px;color:#666}
.app-mini-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;color:#fff;font-size:8.5pt;font-weight:800;flex-shrink:0}
.app-mini-row{display:flex;align-items:center;gap:10px;font-size:9.5pt;color:#444}
.app-mini-name{flex:1}
.app-mini-count{font-weight:700;color:#1B5E20}

.day-chart-wrap{display:flex;gap:8px;width:100%}
.day-yaxis{display:flex;flex-direction:column;justify-content:space-between;padding-bottom:26px;flex-shrink:0}
.day-yaxis-unit{font-size:7.5pt;color:#000;font-weight:600;margin-bottom:4px}
.day-ytick{font-size:8pt;color:#888;font-weight:600}
.day-chart{display:flex!important;gap:8px;align-items:flex-end!important;height:110px;padding:28px 4px 0;flex:1;border-left:1.5px solid #999;border-bottom:1.5px solid #999;position:relative}
.day-chart-gridline{position:absolute;left:0;right:0;border-top:1px dashed #d0d0d0;z-index:0}
.day-col{flex:1;display:flex!important;flex-direction:column!important;align-items:center;height:100%;justify-content:flex-end;position:relative}
.day-bar-outer{width:100%;flex:1;min-height:4px;display:flex!important;flex-direction:column!important;justify-content:flex-end;overflow:visible;background:none;position:relative}
.day-bar-inner{width:60%;margin:0 auto;min-height:5px;border-radius:6px 6px 2px 2px}
.day-col.is-max .day-bar-inner{box-shadow:0 2px 8px rgba(27,94,32,.35)}
.day-count{position:absolute;left:0;right:0;text-align:center;font-size:8pt;font-weight:700;color:#666;white-space:nowrap;pointer-events:none;z-index:1}
.day-col.is-max .day-count{color:#1B5E20;font-size:8.5pt}
.peak-badge{position:absolute;left:50%;transform:translateX(-50%);background:#1B5E20;color:#fff;font-size:7pt;font-weight:600;padding:2px 7px;border-radius:3px;white-space:nowrap;z-index:2}
.table-card{border-radius:0}
table{width:100%;border-collapse:collapse;font-size:9pt;border:1.5px solid #333}
thead tr{background:#1B5E20}
th{color:#fff;padding:10px 12px;text-align:left;font-size:9pt;font-weight:700;border:1px solid #1B5E20}
td{border:1px solid #ccc;padding:9px 12px;vertical-align:top;line-height:1.6;color:#222}
tr:nth-child(even) td{background:#fafafa}

.pill{display:inline-block;white-space:nowrap;padding:2px 8px;font-size:8.5pt;font-weight:700;border-radius:2px}
.status-done{background:#E8F5E9;color:#1B5E20;border:1px solid #A5D6A7}
.status-cancel{background:#FFEBEE;color:#C62828;border:1px solid #EF9A9A}
.status-moved{background:#FFF3E0;color:#E65100;border:1px solid #FFCC80}
.status-wait{background:#F5F5F5;color:#616161;border:1px solid #ddd}
.is-max-cell{background:#E8F5E9;color:#1B5E20;font-weight:700}

.btn-print{background:#1B5E20;color:#fff;border:1px solid #1B5E20;padding:9px 24px;border-radius:3px;font-size:9.5pt;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.btn-print:hover{background:#164A19}
.footer{margin-top:30px;padding-top:14px;border-top:1px solid #ccc;display:flex;justify-content:space-between;font-size:8pt;color:#888}

.gov-header{border:1px solid #0b3d24;border-top:6px solid #0b3d24;padding:16px 24px;background:#fff;color:#111827;margin-bottom:22px}
.page .gov-header-top{
  border-bottom:none !important;
  padding-bottom:14px !important;
}
.gov-emblem{width:56px;height:56px;object-fit:contain;flex-shrink:0}
.gov-header-text h1{font-size:14pt;font-weight:700;margin:0;color:#0b3d24}
.gov-org-name{font-size:9.5pt;margin:4px 0 0;color:#374151}
.gov-header-meta{display:flex;gap:24px;font-size:9pt;margin-top:10px;flex-wrap:wrap;color:#374151}
.print-btn{margin-top:12px;background:#0b3d24;color:#fff;border:none;padding:7px 18px;border-radius:4px;font-family:inherit;font-size:9.5pt;cursor:pointer}
.print-btn:hover{background:#0a3320}

.gov-signature{display:flex;flex-direction:row;align-items:stretch;justify-content:space-between;gap:32px;margin-top:40px;padding-top:24px;font-size:9.5pt;width:100%}
.sign-box{flex:1;border:1px solid #d1d5db;border-radius:4px;padding:20px 16px;text-align:center}
.sign-box .sign-line,.sign-box .sign-name{margin:6px 0}
.sign-box .sign-role{font-weight:700;margin:10px 0 6px;color:#0b3d24}
.sign-box .sign-position,.sign-box .sign-date{margin:4px 0;color:#374151}

.section-title2{display:flex;align-items:center;gap:9px;font-size:11pt;font-weight:700;color:#111;margin-bottom:14px;padding-bottom:8px;border-bottom:1.5px solid #1B5E20}
.section-icon{width:4px;height:16px;border-radius:1px;background:#1B5E20;display:inline-block}
.section-en{font-size:8pt;color:#999;font-weight:500;margin-left:2px}
.chart-title2{display:flex;align-items:center;gap:8px;font-size:10pt;font-weight:700;color:#222;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #eee}
.chart-icon{width:4px;height:14px;border-radius:1px;background:#1B5E20;display:inline-block}
.chart-en{font-size:7.5pt;color:#999;font-weight:500;margin-left:2px}

.kpi-row2{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #E0E0E0;border-radius:4px;overflow:hidden;width:100%;margin:0 auto}
.kpi-box2{display:flex;flex-direction:column;gap:4px;border-right:1px solid #E5E7EB;border-top:3px solid #1B5E20;padding:16px 14px;background:#fff!important;min-width:0}
.kpi-box2:last-child{border-right:none}
.kpi-icon2{display:none}
.kpi-lbl2{font-size:8pt;color:#666;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi-en{display:block;font-size:7pt;color:#aaa;font-weight:400}
.kpi-num2{font-size:19pt;font-weight:800;color:#111;line-height:1.4;white-space:nowrap}
.kpi-unit{font-size:8.5pt;color:#888;font-weight:600;margin-left:3px}

.app-donut-row{display:flex;gap:24px;align-items:center;justify-content:center;width:100%;margin:0 auto}
.donut-chart{width:190px!important;height:190px!important;min-width:190px!important;min-height:190px!important;aspect-ratio:1/1!important;border-radius:50%!important;overflow:hidden;flex:0 0 auto!important;box-shadow:0 2px 6px rgba(0,0,0,.06);position:relative;margin:8px auto 14px auto}
.donut-hole{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:62%;height:62%;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 0 0 1px rgba(0,0,0,.03)}
.donut-hole-pct{font-size:22px;font-weight:800;color:#1B5E20;line-height:1.1}
.donut-hole-lbl{font-size:10px;color:#333;line-height:1.3;margin-top:2px}
.donut-caption{display:none}
.donut-pct{display:block;font-size:16pt;font-weight:800;color:#1B5E20;line-height:1.2}
.donut-lbl{display:block;font-size:8pt;color:#777;margin-top:2px}
.donut-pct{font-size:15pt;font-weight:800;color:#1B5E20;line-height:1}
@media print{
  .gov-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .donut-chart{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .kpi-box2{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
.app-mini-bar{flex:1;height:6px;background:#F0F0F0;border-radius:3px;overflow:hidden}
.app-mini-bar-fill{height:100%;border-radius:3px}
.app-mini-pct{width:32px;text-align:right;color:#555;font-weight:700}
.app-mini-count{width:52px;text-align:right;color:#888;font-size:8pt}

.insight-list{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:16px}
.insight-item{display:flex;gap:14px;align-items:flex-start;padding:18px 20px;border-radius:5px;background:#fafafa;border-left:3px solid #ccc}
.insight-good{border-left-color:#1B5E20}
.insight-info{border-left-color:#1565C0}
.insight-purple{border-left-color:#5E35B1}
.insight-icon{display:none}
.insight-title{font-size:10.5pt;font-weight:700;color:#222}
.insight-sub{font-size:9.5pt;color:#666;margin-top:5px;line-height:1.5}

@media print{
  .gov-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .donut-chart{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .insight-item{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}

/* หมายเหตุ: @media screen and (max-width:640px) ตัวเก่าถูกลบออก (รวมเข้ากับ
   @media screen and (max-width:768px)/(max-width:480px) ท้ายไฟล์แล้ว เพื่อไม่ให้
   สองชุด breakpoint ชนกันเอง — ดูจุดนั้นสำหรับ mobile styles ทั้งหมด) */

/* =========================================================
   Redesign: หัวข้อ "4. วันที่มีการประชุมบ่อย" (การ์ดกราฟ + ตาราง)
   วางท้ายไฟล์ CSS เดิม (ให้โหลดหลังสไตล์เดิม เพื่อ override ด้วย !important)
   ========================================================= */
.chart-card-formal{
  border:1px solid #e3e8e4 !important;
  border-radius:14px !important;
  box-shadow:0 2px 10px rgba(27,94,32,.06) !important;
  padding:22px 24px !important;
  background:#fff !important;
}

/* หัวข้อใหญ่ */
.chart-title2{
  font-size:13pt !important;
  font-weight:800 !important;
  color:#14401A !important;
  border-bottom:none !important;
  padding:0 0 14px 0 !important;
  margin-bottom:18px !important;
  position:relative !important;
}
.chart-title2::after{
  content:"" !important;
  position:absolute; left:0; right:0; bottom:0;
  height:3px;
  border-radius:3px;
  background:linear-gradient(90deg,#1B5E20,#4C8C52 60%,rgba(76,140,82,0)) !important;
}
/* เลขข้อ กลายเป็น badge สี่เหลี่ยมมุมมน แทนขีดเขียวเดิม */
.chart-title2 .section-icon{ display:none !important; }
.chart-title2 .section-num{
  display:inline-flex; align-items:center; justify-content:center;
  width:26px; height:26px;
  background:#1B5E20 !important;
  color:#fff !important;
  border-radius:8px !important;
  font-size:11pt !important;
  margin-right:4px !important;
}
.chart-title2 .chart-en{
  font-size:8.5pt !important;
  color:#8a938b !important;
  font-weight:600 !important;
}

/* กล่องสรุปด้านบน (รวมทั้งสิ้น / สูงสุด) */
.day-summary-row{ gap:14px !important; margin-bottom:18px !important; }
.day-total-box{
  border:none !important;
  background:#F4F7F4 !important;
  border-radius:10px !important;
  padding:12px 18px !important;
  font-size:10pt !important;
  font-weight:600 !important;
  color:#2b3a2d !important;
}
.day-total-icon{ width:24px !important; height:24px !important; }
.day-total-icon svg{ width:14px !important; height:14px !important; }
.day-total-box b{ color:#1B5E20 !important; font-size:12pt !important; }

.day-peak-box{
  background:#EAF3EB !important;
  border-radius:10px !important;
  padding:12px 18px !important;
  font-size:10pt !important;
  font-weight:600 !important;
  color:#2b3a2d !important;
}
.day-peak-star{
  background:#8C6A3D !important;
  border-radius:20px !important;
  padding:4px 12px !important;
  font-size:9pt !important;
  box-shadow:0 2px 6px rgba(140,106,61,.25) !important;
}

/* กราฟแท่ง แบบ Histogram (แท่งชิดกัน) */
.day-chart{
  height:130px !important;
  border-left:none !important;
  border-bottom:none !important;
  gap:2px !important;
}
.day-chart-gridline{ border-top:1px dashed #e6eae6 !important; }
.day-bar-inner{
  border-radius:4px 4px 0 0 !important;
  background:linear-gradient(180deg,#4C8C52,#1B5E20) !important;
  width:100% !important;
}
/* แท่งที่สูงสุด: โทนบรอนซ์/น้ำตาลอมทอง เรียบคลาสสิค ไม่ฉูดฉาด */
.day-col.is-max .day-bar-inner{
  background:linear-gradient(180deg,#B8935A,#8C6A3D) !important;
  box-shadow:0 3px 8px rgba(140,106,61,.28) !important;
}
.day-col.is-max .day-count{ color:#7A5A32 !important; }
.day-count{ font-size:9pt !important; font-weight:800 !important; }
.day-name{ font-size:9.5pt !important; font-weight:700 !important; margin-top:8px !important; color:#3a453c !important; }

/* ตารางสรุปด้านล่าง */
.day-summary-table{
  border:none !important;
  border-radius:10px !important;
  overflow:hidden !important;
  box-shadow:0 1px 4px rgba(0,0,0,.06) !important;
  margin-top:22px !important;
}
.day-summary-table th{
  background:#1B5E20 !important;
  color:#fff !important;
  border:none !important;
  padding:10px 8px !important;
  font-size:9pt !important;
}
.day-summary-table td{
  border:none !important;
  border-bottom:1px solid #eef1ee !important;
  padding:9px 8px !important;
}
.day-summary-table td:first-child{ background:#F7F9F7 !important; }
.is-max-cell{ color:#7A5A32 !important; }
.day-note{ font-style:italic !important; }

/* ไฮไลต์คอลัมน์ "พฤ." (ค่าสูงสุด) ในตารางด้วยสีส้ม/บรอนซ์ + ตัวหนา */
.day-summary-table thead th{ font-weight:800 !important; }
.day-summary-table tbody tr td:nth-child(6){
  color:#B67900 !important;
  font-weight:800 !important;
}
/* คอลัมน์ "รวม" ตัวหนา สีเขียวเข้ม */
.day-summary-table tbody tr td:last-child{
  font-weight:800 !important;
  color:#14401A !important;
}

/* ===========================================================
   การใช้งานแพลตฟอร์มย้อนหลัง 6 เดือน (กราฟเส้น + ตาราง)
   =========================================================== */
.usage-block{ padding:4px 2px !important; }
.usage-block:not(.usage-block-divider){
  padding:24px !important;
  border:1px solid #e3e8e4 !important;
  border-radius:14px !important;
  background:#fff !important;
  box-shadow:0 2px 10px rgba(27,94,32,.06) !important;
}
.trend-header-row{ margin-bottom:20px !important; }

.trend-chart-row{ gap:28px !important; align-items:center !important; }
.trend-chart-svg line{ stroke:#eef1ee !important; stroke-dasharray:3,3 !important; }
.trend-chart-svg text{ fill:#9aa39b !important; font-size:9px !important; }
.trend-chart-svg polyline{ stroke-width:2.6 !important; }
.trend-chart-svg circle{ stroke:#fff !important; stroke-width:1.5 !important; }

.trend-legend{ gap:12px !important; background:#F8FAF8 !important; border-radius:10px !important; padding:14px 16px !important; }
.trend-legend-item{ font-size:9.5pt !important; font-weight:600 !important; color:#333 !important; }
.trend-legend-dot{ width:10px !important; height:10px !important; border-radius:3px !important; }

.trend-table{
  border:none !important;
  border-radius:10px !important;
  overflow:hidden !important;
  box-shadow:0 1px 4px rgba(0,0,0,.06) !important;
  margin-top:24px !important;
}
.trend-table th{
  background:#1B5E20 !important;
  color:#fff !important;
  border:none !important;
  padding:10px 6px !important;
}
.trend-table td{
  border:none !important;
  border-bottom:1px solid #eef1ee !important;
}
.trend-table-app{ background:#F7F9F7 !important; }
.trend-table-total-row td{
  background:#EAF3EB !important;
  color:#14401A !important;
  font-weight:800 !important;
  border-top:1.5px solid #1B5E20 !important;
}

/* ===========================================================
   หัวข้อ 5. รายการประชุม (ตารางรายการ)
   =========================================================== */
.section-title2{
  font-size:13pt !important;
  font-weight:800 !important;
  color:#14401A !important;
  border-bottom:none !important;
  padding:0 0 14px 0 !important;
  margin-bottom:16px !important;
  position:relative !important;
}
.section-title2::after{
  content:"" !important;
  position:absolute; left:0; right:0; bottom:0;
  height:3px;
  border-radius:3px;
  background:linear-gradient(90deg,#1B5E20,#4C8C52 60%,rgba(76,140,82,0)) !important;
}
.section-title2 .section-icon{ display:none !important; }
.section-title2 .section-num{
  display:inline-flex; align-items:center; justify-content:center;
  width:26px; height:26px;
  background:#1B5E20 !important;
  color:#fff !important;
  border-radius:8px !important;
  font-size:11pt !important;
  margin-right:0 !important;
}
.section-title2 .section-en{
  font-size:8.5pt !important;
  color:#8a938b !important;
  font-weight:600 !important;
}

.table-card{
  border-radius:14px !important;
  overflow:hidden !important;
  box-shadow:0 2px 10px rgba(27,94,32,.07) !important;
  border:1px solid #e3e8e4 !important;
}
.table-card table{
  border:none !important;
  font-size:9pt !important;
}
.table-card thead tr{ background:#1B5E20 !important; }
.table-card th{
  border:none !important;
  padding:12px 14px !important;
  font-weight:700 !important;
  letter-spacing:.2px !important;
}
.table-card td{
  border:none !important;
  border-bottom:1px solid #eef1ee !important;
  padding:11px 14px !important;
  color:#333 !important;
}
.table-card tr:nth-child(even) td{ background:#F8FAF8 !important; }
.table-card tbody tr:hover td{ background:#EFF5EF !important; }

.pill{
  border-radius:20px !important;
  padding:4px 12px !important;
  font-weight:700 !important;
  border:none !important;
  display:inline-flex !important;
  align-items:center !important;
  gap:5px !important;
}
.pill::before{
  content:"" !important;
  width:6px; height:6px; border-radius:50%;
  display:inline-block;
  background:currentColor !important;
}
.status-done{ background:#E8F5E9 !important; color:#1B5E20 !important; }
.status-cancel{ background:#FDECEA !important; color:#C62828 !important; }
.status-moved{ background:#FFF3E0 !important; color:#E65100 !important; }
.status-wait{ background:#F1F2F1 !important; color:#666 !important; }

/* ===========================================================
   หัวข้อ 3. สรุปภาพรวม (Key Insights)
   =========================================================== */
.insight-list{ gap:12px !important; }
.insight-item{
  background:#F8FAF8 !important;
  border-radius:10px !important;
  padding:14px 16px !important;
  border-left:3px solid transparent !important;
  align-items:center !important;
  gap:14px !important;
}
.insight-good{ border-left-color:#1B5E20 !important; }
.insight-info{ border-left-color:#1565C0 !important; background:#F5F8FC !important; }
.insight-purple{ border-left-color:#5E35B1 !important; background:#F8F6FB !important; }

.page .sign-box .sign-role{ color:#111 !important; }

/* แก้บั๊กเดิมของเว็บที่ซ่อนไอคอนกลมไว้ (display:none) ให้กลับมาโชว์ */
.insight-icon{
  display:inline-flex !important;
  width:26px !important;
  height:26px !important;
  font-size:11pt !important;
  box-shadow:0 2px 5px rgba(0,0,0,.12) !important;
}
.insight-icon svg{ width:14px !important; height:14px !important; }
.insight-title{ font-size:10pt !important; color:#1a1a1a !important; }
.insight-sub{ font-size:9pt !important; color:#707870 !important; }

/* ===== Header กรมฯ — โลโก้กรอบทอง + เส้นคั่นทอง + meta ไอคอนวงกลม ===== */
.page .gov-emblem{
  width:72px !important; height:72px !important;
  border-radius:50% !important;
  border:2.5px solid #C9A227 !important;
  padding:4px !important; background:#fff !important;
  box-shadow:0 2px 6px rgba(0,0,0,.12) !important;
}
.page .gov-header{ border-top:5px solid #0b3d24 !important; border-radius:0 0 6px 6px !important; }

/* ===== แก้ส่วนหัว header ให้เรียงแนวนอน (override centering เดิม) ===== */
.page .gov-header{
  flex-direction:column !important;
  align-items:stretch !important;
  text-align:left !important;
}
.page .gov-header-top{
  display:flex !important;
  flex-direction:row !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:18px !important;
  text-align:left !important;
  width:100% !important;
}
.page .gov-header-text{
  text-align:left !important;
  align-items:flex-start !important;
  flex:1 !important;
}
.page .gov-header-text h1{ text-align:left !important; }
.page .gov-header-text .gov-org-name{ text-align:left !important; }
.page .gov-emblem{ margin:0 !important; flex-shrink:0 !important; }
.page .gov-header-divider{ width:100% !important; }
.page .gov-header-meta{ width:100% !important; }

/* เส้นคั่นทองมีเพชรกลาง */
.page .gov-header-divider{
  display:flex !important; align-items:center !important; justify-content:center !important;
  margin:14px 0 !important; position:relative !important;
}
.page .gov-header-divider::before,
.page .gov-header-divider::after{
  content:"" !important; height:1px !important; flex:1 !important;
  background:linear-gradient(90deg,transparent,#C9A227) !important;
}
.page .gov-header-divider::after{ background:linear-gradient(90deg,#C9A227,transparent) !important; }
.page .gov-divider-diamond{ color:#C9A227 !important; font-size:10px !important; padding:0 10px !important; }

/* แถบ meta 4 ช่อง ไอคอนวงกลมเขียว */
.page .gov-header-meta{
  display:flex !important; justify-content:space-around !important; align-items:center !important;
  gap:0 !important; flex-wrap:nowrap !important; margin-top:12px !important;
  background:#fff !important;
  border:1px solid #e3e8e4 !important;
  border-radius:12px !important;
  box-shadow:0 2px 8px rgba(11,61,36,.08) !important;
  padding:16px 12px !important;
}
.page .gov-meta-item{
  display:flex !important; align-items:center !important; gap:12px !important;
  flex:1 !important; padding:6px 20px !important;
  border-right:1px solid #e5e7eb !important;
}
.page .gov-meta-item:last-child{ border-right:none !important; }
.page .gov-meta-icon{
  width:36px !important; height:36px !important; flex-shrink:0 !important;
  display:flex !important; align-items:center !important; justify-content:center !important;
  background:#0b3d24 !important;
  border-radius:50% !important;
}
.page .gov-meta-icon svg{
  width:18px !important; height:18px !important;
}
.page .gov-meta-text{ display:flex !important; flex-direction:column !important; gap:2px !important; min-width:0 !important; }
.page .gov-meta-label{ font-size:8pt !important; color:#8a938b !important; line-height:1.5 !important; }
.page .gov-meta-text strong{ font-size:9.5pt !important; color:#14401A !important; line-height:1.5 !important; }

@media (max-width:820px){
  .page .gov-header-meta{
    display:grid !important;
    grid-template-columns:1fr 1fr !important;
    align-items:stretch !important;
    gap:0 !important;
    padding:0 !important;
  }
  .page .gov-meta-item{
    flex:none !important;
    align-items:center !important;
    box-sizing:border-box !important;
    border:none !important;
    border-bottom:1px solid #eef1ee !important;
    padding:16px 14px !important;
  }
  /* ช่องซ้าย (1,3) มีเส้นขวา */
  .page .gov-meta-item:nth-child(odd){
    border-right:1px solid #eef1ee !important;
  }
  /* แถวล่าง (3,4) ไม่มีเส้นใต้ */
  .page .gov-meta-item:nth-child(3),
  .page .gov-meta-item:nth-child(4){
    border-bottom:none !important;
  }
}

@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
  body{background:#fff;font-size:8pt;display:block!important}
  .page{padding:0.8cm;max-width:none;box-shadow:none;width:100%;display:block!important}
  .hdr,.section,.table-card,.gov-header,.gov-signature,.footer,.chart-card,.chart-card-formal,header,.stats-grid,.insight-list{justify-content:flex-start!important;align-items:flex-start!important}
  .chart-title2,.section-title2{width:100%;justify-content:flex-start!important}
  .btn-print,.print-btn{display:none}
  thead{display:table-header-group}
  .table-card{overflow:visible}
  .table-card tr{break-inside:avoid;page-break-inside:avoid}
  .table-card table{font-size:6.5pt!important}
  .table-card th{padding:3px 4px!important;font-size:6.5pt!important}
  .table-card td{padding:2.5px 4px!important;font-size:6.5pt!important;line-height:1.25!important}
  td,th{border-left:none;border-right:none}
  .section{margin-bottom:10px}
  .chart-card-formal{padding:8px 10px!important}
  .kpi-row2{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:4px!important}
  .kpi-box2{padding:6px!important}
  .kpi-num2{font-size:11pt!important}
  .kpi-icon2{width:22px!important;height:22px!important;font-size:10px!important}

  /* ===== FIX: Section 2 ===== */
  .usage-row{display:block!important;gap:0!important;width:100%!important;margin:0!important;padding:0!important;}
  .usage-block{display:block!important;width:100%!important;margin:0 0 4px 0!important;padding:0!important;page-break-inside:avoid;}
  .usage-block-divider{padding-top:2px!important;margin-top:0!important;border-top:none!important;page-break-inside:avoid;}
  .app-donut-row{display:flex;justify-content:center;width:100%;margin:0!important;padding:0!important;}

  .donut-chart{width:95px!important;height:95px!important;min-width:95px!important;min-height:95px!important;margin:0px auto 1px auto!important;}
  .donut-hole{width:62%!important;height:62%!important;}
  .donut-hole-pct{font-size:7.5pt!important;}
  .donut-hole-lbl{font-size:3pt!important;line-height:1!important;}

  .app-mini-list{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;}
  .mini-list-heading{font-size:5.5pt!important;margin:0px 0 1px 0!important;page-break-after:avoid;padding:0!important;}
  .app-mini-row2{display:flex!important;align-items:center!important;gap:1.5px!important;margin-bottom:0px!important;padding:0px!important;font-size:5pt!important;page-break-inside:avoid;}
  .app-mini-dot{width:3px!important;height:3px!important;flex-shrink:0!important;}
  .app-mini-name{flex:0 0 35px!important;font-size:5pt!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .app-mini-bar{flex:1 1 auto!important;height:1px!important;}
  .app-mini-pct{flex:0 0 14px!important;font-size:5pt!important;text-align:right!important;}
  .app-mini-count{flex:0 0 25px!important;font-size:5pt!important;text-align:right!important;}

  .chart-title2,.section-title2{font-size:6pt!important;font-weight:800!important;color:#14401A!important;margin-bottom:5px!important;padding-bottom:0!important;border-bottom:none!important;}
  .chart-title2::after,.section-title2::after{display:none!important;}
  .chart-title2 .section-num,.section-title2 .section-num{width:12px!important;height:12px!important;font-size:5.5pt!important;border-radius:3px!important;margin-right:2px!important;}
  .chart-title2 .chart-en,.section-title2 .section-en{font-size:5pt!important;}
  .trend-header-row{flex-wrap:wrap!important;gap:0px!important;page-break-after:avoid;margin-top:0px!important;background:#1B5E20!important;color:#fff!important;padding:1px 3px!important;font-weight:700!important;font-size:5pt!important;border-radius:2px!important;}
  .trend-subtitle{color:#fff!important;font-size:5pt!important;}
  .trend-chart-svg svg{width:100%!important;height:auto!important;}
  .trend-chart-row{gap:0px!important;flex-direction:column;margin:0!important;padding:0!important;}
  .trend-legend{display:none!important;}
  .trend-table{font-size:5pt!important;margin-top:0px!important;}
  .trend-table th,.trend-table td{padding:0.5px 0.3px!important;font-size:5pt!important;}
  .trend-table th{background:#1B5E20!important;color:#fff!important;}
  /* ===== END FIX ===== */

  .day-summary-row{margin:2px 0!important}
  .day-chart-wrap{margin-top:2px!important}
  .day-chart{height:70px!important;padding:18px 4px 0!important}
  .day-summary-table{margin-top:4px!important;font-size:6pt!important}
  .day-summary-table th,.day-summary-table td{padding:2px!important}
  .day-note{margin-top:1px!important;font-size:5pt!important}
  .insight-item{padding:4px 6px!important;gap:4px!important;page-break-inside:avoid}
  .insight-title{font-size:6.5pt!important;font-weight:700!important;line-height:1.25!important}
  .insight-sub{font-size:6pt!important;line-height:1.25!important;margin-top:1px!important}
  .gov-header{padding:8px 10px!important}
  .gov-header-text h1{font-size:10pt!important}
  .gov-header,.kpi-row2,.day-summary-row,.insight-item,.sign-box,.day-summary-table{break-inside:avoid}
  .section-title2,.chart-title2{break-after:avoid!important;break-inside:avoid!important}
  .section-pagebreak{break-before:page!important}
  @page{
    margin:0.8cm 0.8cm 1cm 0.8cm;
    size:A4;
    @bottom-center{
      content:"หน้า " counter(page) " จาก " counter(pages);
      font-size:7pt;
      color:#888;
    }
  }
}


/* ========================================
   Mobile A4 PDF Viewing Support
   ======================================== */

@media screen and (max-width: 768px) {
  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    overflow-x: hidden;
  }

  /* กันหัวข้อ/การ์ดถูกจัดกลางโดย align-items:center ของ base "CENTERING ALL SECTIONS"
     (ต้นเหตุที่หัวข้อบางอันชิดซ้าย บางอันอยู่กลางไม่ตรงกัน) — บังคับชิดซ้ายให้ตรงกันหมด */
  .hdr,.section,.table-card,.gov-header,.gov-signature,.footer,
  .chart-card,.chart-card-formal,header,.stats-grid,.insight-list {
    align-items: flex-start !important;
  }
  .chart-title2, .section-title2 {
    width: 100%;
    justify-content: flex-start !important;
  }

  .gov-header-text { min-width: 0; }

  .page {
    width: 100%;
    max-width: 100%;
    padding: 6px 8px !important;
    margin: 0 auto;
    background: #fff;
  }

  /* ===== Header ===== */
  .gov-header {
    padding: 6px 8px !important;
    gap: 8px !important;
  }

  .gov-header-top {
    gap: 8px !important;
  }

  .gov-emblem {
    width: 48px !important;
    height: 48px !important;
  }

  .gov-header-text h1 {
    font-size: 9pt !important;
    line-height: 1.2 !important;
  }

  .gov-org-name {
    font-size: 7pt !important;
    line-height: 1.2 !important;
  }

  .gov-header-divider {
    margin: 8px 0 !important;
  }

  .gov-header-meta {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: transparent !important;
  }

  .gov-meta-item {
    flex: none !important;
    padding: 6px 4px !important;
    border: 1px solid #e0e0e0 !important;
    gap: 6px !important;
  }

  .gov-meta-item:nth-child(1),
  .gov-meta-item:nth-child(3) {
    border-right: 1px solid #e0e0e0 !important;
  }

  .gov-meta-item:nth-child(1),
  .gov-meta-item:nth-child(2) {
    border-bottom: 1px solid #e0e0e0 !important;
  }

  .gov-meta-icon {
    width: 24px !important;
    height: 24px !important;
    font-size: 10px !important;
  }

  .gov-meta-label {
    font-size: 6pt !important;
  }

  .gov-meta-text strong {
    font-size: 7pt !important;
  }

  /* ===== Sections ===== */
  .section {
    margin-bottom: 10px !important;
  }

  .section-title2, .chart-title2 {
    font-size: 7pt !important;
    margin-bottom: 6px !important;
    padding-bottom: 0 !important;
    border-bottom: none !important;
  }
  .section-title2::after, .chart-title2::after {
    display: none !important;
  }

  /* ===== KPI ===== */
  .kpi-row2 {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 4px !important;
  }

  .kpi-box2 {
    padding: 4px !important;
    border-top-width: 2px !important;
  }

  .kpi-num2 {
    font-size: 10pt !important;
  }

  .kpi-lbl2 {
    font-size: 6pt !important;
  }

  /* ===== Section 2: Usage ===== */
  .usage-row {
    display: block !important;
    gap: 0 !important;
  }

  .usage-block {
    margin-bottom: 4px !important;
  }

  .donut-chart {
    width: 80px !important;
    height: 80px !important;
    min-width: 80px !important;
    min-height: 80px !important;
    margin: 2px auto !important;
  }

  .donut-hole-pct {
    font-size: 7pt !important;
  }

  .donut-hole-lbl {
    font-size: 4pt !important;
    line-height: 1 !important;
  }

  .mini-list-heading {
    font-size: 6pt !important;
    margin: 2px 0 !important;
  }

  .app-mini-row2 {
    gap: 2px !important;
    margin-bottom: 1px !important;
    font-size: 5.5pt !important;
  }

  .app-mini-name {
    flex: 0 0 35px !important;
    font-size: 5.5pt !important;
  }

  .app-mini-pct,
  .app-mini-count {
    font-size: 5.5pt !important;
  }

  /* ===== Trend ===== */
  .chart-title2 {
    font-size: 6pt !important;
  }

  .trend-header-row {
    font-size: 5pt !important;
    padding: 1px !important;
  }

  .trend-chart-svg svg {
    width: 100% !important;
    height: auto !important;
  }

  .trend-table {
    display: block !important;
    overflow-x: auto !important;
    white-space: nowrap !important;
    min-width: 0 !important;
    width: 100% !important;
    font-size: 6.5pt !important;
    margin-top: 1px !important;
  }
  .trend-table thead { display: table-header-group !important; }
  .trend-table tbody { display: table-row-group !important; }
  .trend-table tr { display: table-row !important; }

  .trend-table th,
  .trend-table td {
    display: table-cell !important;
    min-width: 46px;
    padding: 3px 4px !important;
    font-size: 6.5pt !important;
  }

  /* ===== Day Chart ===== */
  .day-summary-row {
    flex-direction: column !important;
    gap: 4px !important;
    margin: 2px 0 !important;
  }

  .day-total-box,
  .day-peak-box {
    font-size: 7pt !important;
    padding: 4px !important;
  }

  .day-chart-wrap {
    gap: 4px !important;
  }

  .day-chart {
    gap: 2px !important;
    padding: 32px 2px 0 !important;
  }

  .day-col {
    min-width: 0 !important;
  }

  .day-count {
    font-size: 5.5pt !important;
    overflow: hidden;
  }
  .day-col.is-max .day-count {
    font-size: 6pt !important;
  }

  .day-name {
    font-size: 6.5pt !important;
    margin-top: 4px !important;
  }

  .peak-badge {
    font-size: 5.5pt !important;
    padding: 1px 4px !important;
  }

  .day-summary-table {
    font-size: 6pt !important;
    margin-top: 2px !important;
    overflow-x: auto !important;
    display: block !important;
  }

  .day-summary-table th,
  .day-summary-table td {
    padding: 2px !important;
  }

  .day-name {
    font-size: 6pt !important;
  }

  /* ===== Insights ===== */
  .insight-item {
    padding: 4px !important;
    gap: 4px !important;
    margin-bottom: 4px !important;
  }

  .insight-title {
    font-size: 6.5pt !important;
    font-weight: 700 !important;
    line-height: 1.25 !important;
  }

  .insight-sub {
    font-size: 6pt !important;
    line-height: 1.25 !important;
    margin-top: 1px !important;
  }

  .insight-icon {
    width: 18px !important;
    height: 18px !important;
  }

  /* ===== Tables ===== */
  .table-card {
    overflow-x: auto !important;
    border-radius: 4px !important;
  }

  .table-card table {
    font-size: 5.5pt !important;
    min-width: 500px !important;
  }

  .table-card th {
    padding: 2px !important;
    font-size: 5.5pt !important;
  }

  .table-card td {
    padding: 2px !important;
  }

  .pill {
    padding: 1px 4px !important;
    font-size: 5pt !important;
  }

  /* ===== Signature ===== */
  .gov-signature {
    flex-direction: column !important;
    gap: 8px !important;
    margin-top: 10px !important;
    padding-top: 10px !important;
  }

  .sign-box {
    padding: 6px !important;
    font-size: 6pt !important;
  }

  .sign-line,
  .sign-name,
  .sign-role,
  .sign-position,
  .sign-date {
    font-size: 6pt !important;
    margin: 2px 0 !important;
  }

  /* ===== Footer ===== */
  .footer {
    font-size: 6pt !important;
    margin-top: 6px !important;
    padding-top: 6px !important;
  }

  /* ===== Print Button ===== */
  .print-btn {
    font-size: 8pt !important;
    padding: 4px 8px !important;
  }
}

/* ===== Extra Small Devices (< 480px) ===== */
@media screen and (max-width: 480px) {
  .page {
    padding: 4px 6px !important;
  }

  .gov-header {
    padding: 4px 6px !important;
  }

  .gov-emblem {
    width: 40px !important;
    height: 40px !important;
  }

  .gov-header-text h1 {
    font-size: 8pt !important;
  }

  .gov-org-name {
    font-size: 6pt !important;
  }

  .gov-header-meta {
    display: block !important;
  }

  .gov-meta-item {
    padding: 4px !important;
    border: none !important;
    border-bottom: 1px solid #e0e0e0 !important;
  }

  .gov-meta-item:last-child {
    border-bottom: none !important;
  }

  .section {
    margin-bottom: 2px !important;
  }

  .kpi-row2 {
    grid-template-columns: 1fr !important;
  }

  .donut-chart {
    width: 70px !important;
    height: 70px !important;
    min-width: 70px !important;
    min-height: 70px !important;
  }

  .trend-chart-svg svg {
    height: auto !important;
  }

  .day-chart {
    gap: 1px !important;
    padding: 30px 1px 0 !important;
  }
  .day-count { font-size: 5.5pt !important; }
  .day-name { font-size: 6pt !important; }

  .table-card table {
    min-width: 400px !important;
    font-size: 5pt !important;
  }

  .insight-item {
    padding: 3px !important;
  }
}

/* ============================================================
   report-summary-insight.css
   หน้า: /report/summary  ->  บล็อก "3. สรุปภาพรวม" (.insight-list)
   แนวทาง: สีเน้นสีเดียว (เขียวแบรนด์ #1B5E20) + neutral
           เน้นการ์ดที่สำคัญที่สุดเพียงใบเดียว
   ใช้ทั้งมุมมองหน้าจอปกติและตอนปริ้น/เซฟ PDF จึงไม่ห่อด้วย @media print
   วางไว้ท้ายสุดของ _BASE_STYLE เพื่อให้ชนะกฎ .insight-* ที่ patch ไว้ก่อนหน้าทั้งหมด
   ============================================================ */
:root {
  --rpt-brand:        #1B5E20;  /* เขียวแบรนด์ */
  --rpt-brand-deep:   #14401A;  /* หัวข้อใบเน้น */
  --rpt-brand-tint:   #F5F9F5;  /* พื้นใบเน้น */
  --rpt-brand-line:   #CFE0CF;  /* ขอบใบเน้น */
  --rpt-icon-bg:      #E9EFE9;  /* พื้นไอคอนใบรอง */
  --rpt-icon-fg:      #4A7A4F;  /* เส้นไอคอนใบรอง */
  --rpt-border:       #E6E8E6;  /* ขอบการ์ดทั่วไป */
  --rpt-text:         #1F2A1F;  /* ตัวหนังสือหลัก */
  --rpt-text-muted:   #6B726B;  /* คำอธิบาย */
}

.insight-list {
  gap: 10px !important;
}

/* การ์ดทั่วไป: พื้นขาว ขอบเทาบาง ไม่มีเงา ไม่มีแถบสีซ้าย */
.insight-item {
  display: flex !important;
  align-items: flex-start !important;
  gap: 12px !important;
  padding: 14px 16px !important;
  background: #fff !important;
  border: 1px solid var(--rpt-border) !important;
  border-left: 1px solid var(--rpt-border) !important;   /* ล้างแถบสีเดิม */
  border-radius: 10px !important;
  box-shadow: none !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* การ์ดใบแรก = ใบที่เน้น (ใบเดียวเท่านั้น) */
.insight-item:first-child {
  padding-left: 14px !important;
  background: var(--rpt-brand-tint) !important;
  border-color: var(--rpt-brand-line) !important;
  border-left: 3px solid var(--rpt-brand) !important;
}

.insight-icon {
  flex: 0 0 auto !important;
  width: 26px !important;
  height: 26px !important;
  margin-top: 1px !important;
  border-radius: 50% !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: var(--rpt-icon-bg) !important;
  box-shadow: none !important;
}

.insight-icon svg {
  width: 14px !important;
  height: 14px !important;
  stroke: var(--rpt-icon-fg) !important;   /* ทับ stroke="#fff" ที่ติดมากับ SVG */
}

.insight-item:first-child .insight-icon     { background: var(--rpt-brand) !important; }
.insight-item:first-child .insight-icon svg { stroke: #fff !important; }

.insight-title {
  color: var(--rpt-text) !important;
  font-weight: 700 !important;
  line-height: 1.5 !important;
}

.insight-item:first-child .insight-title {
  color: var(--rpt-brand-deep) !important;
}

.insight-sub {
  margin-top: 2px !important;
  color: var(--rpt-text-muted) !important;
  line-height: 1.62 !important;
}
"""
#-----------------
# GET /report/summary - รายงานสรุป KPI
#-----------------
@router.get("/summary", response_class=HTMLResponse)

def report_summary(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    week_start: Optional[str] = Query(None),
    week_end: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ConferenceEvent).filter(ConferenceEvent.deleted_at.is_(None))

    if week_start and week_end:
        q = q.filter(ConferenceEvent.date >= week_start).filter(ConferenceEvent.date <= week_end)
        scope = f"สัปดาห์ {format_date_th(week_start, short=True)} - {format_date_th(week_end, short=True)}"
    else:
        q = q.filter(extract("year", ConferenceEvent.date) == year)
        if month:
            q = q.filter(extract("month", ConferenceEvent.date) == month)
        scope = f"เดือน{MONTHS_TH.get(month,'')} พ.ศ. {year}" if month else f"ปี พ.ศ. {year}"

    events = q.order_by(ConferenceEvent.date).all()

    # KPI
    total   = len(events)
    avg_min = 0
    if total:
        total_min = sum((end - start) for start, end in (parse_time_range(e.time_raw) for e in events))
        avg_min = round(total_min / total)
    ready_pct = round(sum(1 for e in events if "สร้าง link" in (e.status or "")) / total * 100) if total else 0
    dept_count = len(set(e.department for e in events if e.department))

    #APP breakdown
    def normalize_app_name(name: str) -> str:
        n = (name or "").strip()
        if not n:
            return "อื่นๆ"
        n_lower = n.lower().replace(" ", "")
        if "zoom" in n_lower:
            return "Zoom"
        if "team" in n_lower:
            return "MS Teams"
        if "webex" in n_lower:
            return "Webex"
        if "meet" in n_lower:
            return "Google Meet"
        return n

    app_map = {}
    for e in events:
        a = normalize_app_name(e.app)
        app_map[a] = app_map.get(a, 0) + 1
    app_entries = sorted(app_map.items(), key=lambda x: -x[1])[:5]

    #Dept breakdown
    dept_map = {}
    for e in events:
        d = (e.department or "ไม่ระบุ").strip() or "ไม่ระบุ"
        dept_map[d] = dept_map.get(d, 0) + 1
    dept_entries = sorted(dept_map.items(), key=lambda x: -x[1])[:8]
    ready_status = "อยู่ในเกณฑ์ดี" if ready_pct >= 80 else "ควรติดตาม"
    #Day of week 
    day_count = [0]*7
    for e in events:
        idx = _weekday_idx(e.date)
        if idx is not None:
            day_count[idx] += 1
    day_max = max(day_count) or 1
    max_day_idx = day_count.index(max(day_count)) if max(day_count) > 0 else None
    max_day_name = DAY_FULL[max_day_idx] if max_day_idx is not None else "-"
    day_total = sum(day_count)
    max_day_pct = round(day_count[max_day_idx]/day_total*100, 1) if max_day_idx is not None and day_total > 0 else 0
    day_axis_max = ((day_max // 5) + 1) * 5 if day_max > 0 else 5
    #Table rows
    rows_html = "".join(f"""
    <tr>
      <td>{esc(format_date_th(str(e.date), short=True))}</td>
      <td>{esc(e.time_raw or '-')}</td>
      <td>{esc(e.title or '-')}</td>
      <td>{esc(e.department or '-')}</td>
      <td>{esc(e.app or '-')}</td>
      <td><span class="pill status-{get_status_cls(e.status)}">{esc(get_status_label(e.status))}</span></td>
    </tr>""" for e in events)

    def _app_icon(name: str) -> tuple[str, str]:
        """ ตัวอักษรย่อ,สีพื้นหลัง"""
        n = name.lower()
        if "zoom" in n: return ("Z", "#2D8CFF")
        if "team" in n: return ("T", "#5059C9")
        if "webex" in n: return ("W", "#00BCEB")
        if "meet" in n: return ("G", "#00897B")
        return (".", "#9E9E9E")

    top_app_name, top_app_cnt = app_entries[0] if app_entries else ("-", 0)
    top_app_pct = round(top_app_cnt / total * 100) if total else 0
    _APP_COLORS = ["#1B5E20", "#2E7D32", "#66BB6A", "#A5D6A7", "#C8E6C9", "#E0E0E0"]

    def _build_donut_gradient(entries, total_count):
        """สร้าง conic-gradient หลายสีตามสัดส่วน app"""
        if not entries or total_count == 0:
            return "conic-gradient(#E0E0E0 0deg 360deg)"
        segments = []
        current_deg = 0
        for i, (name, cnt) in enumerate(entries):
            pct_deg = round(cnt / total_count * 360)
            color = _APP_COLORS[min(i, len(_APP_COLORS)-1)]
            segments.append(f"{color} {current_deg}deg {current_deg + pct_deg}deg")
            current_deg += pct_deg
        if current_deg < 360:
            segments.append(f"#E0E0E0 {current_deg}deg 360deg")
        return f"conic-gradient({','.join(segments)})"

    donut_gradient = _build_donut_gradient(app_entries, total)
    def _app_row(name, cnt):
        letter, color = _app_icon(name)
        return f"""
            <div class="app-mini-row">
              <span class="app-mini-icon" style="background:{color}">{letter}</span>
              <span class="app-mini-name">{esc(name)}</span>
              <span class="app-mini-count">{cnt}</span>
            </div>"""

    def _app_row2(name, cnt, idx=0):
        letter, color = _app_icon(name)
        pct = round(cnt/total*100) if total else 0
        dot_color = _APP_COLORS[min(idx, len(_APP_COLORS)-1)]
        return f"""
    <div class="app-mini-row2">
      <span class="app-mini-dot" style="background:{dot_color}"></span>
      <span class="app-mini-name">{esc(name)}</span>
      <div class="app-mini-bar"><div class="app-mini-bar-fill" style="width:{pct}%;background:{dot_color}"></div></div>
      <span class="app-mini-pct">{pct}%</span>
      <span class="app-mini-count">{cnt} ครั้ง</span>
    </div>"""

    app_row_all = "".join(
        _app_row2(name, cnt, idx=idx)
        for idx, (name, cnt) in enumerate(app_entries)
    )

    def _day_bar_color(cnt: int, max_cnt: int) -> str:
        """สีแท่งทึบแบบทางการ - 0=เทาอ่อน สูงสุด=เขียวเข้ม อื่นๆ=เขียวกลาง"""
        if max_cnt == 0 or cnt == 0:
            return "#e6e6e6"
        if cnt == max_cnt:
            return "#1B5E20"
        return "#4C8C52"

    def _bar_pct(cnt):
        return round(cnt/day_axis_max*100) if day_axis_max else 0

    day_cols = "".join(f"""
            <div class="day-col{' is-max' if cnt == day_max and cnt > 0 else ''}">
              <div class="day-bar-outer">
                {'<div class="peak-badge" style="bottom:calc(' + str(_bar_pct(cnt)) + '% + 24px)">สูงสุด</div>' if cnt == day_max and cnt > 0 else ''}
                <div class="day-count" style="bottom:calc({_bar_pct(cnt)}% + 4px)">{f'{cnt} ครั้ง' if cnt > 0 else ''}</div>
                <div class="day-bar-inner" style="height:{_bar_pct(cnt)}%;background:{_day_bar_color(cnt, day_max)};border:1px solid {'#14431a' if cnt > 0 else 'transparent'}"></div>
              </div>
              <div class="day-name">{DAYS_TH[i]}</div>
            </div>""" for i, cnt in enumerate(day_count))


    now = datetime.now()
    prepared_date = f"{now.day} {MONTHS_TH[now.month]} {ce_to_be_year(now.year)}"
    prepared_time = f"{now.strftime('%H.%M')} น."

    # ===== ข้อมูลย้อนหลัง 6 เดือน สำหรับกราฟเส้น =====
    THAI_MONTH_SHORT = {
        1:"ม.ค.",2:"ก.พ.",3:"มี.ค.",4:"เม.ย.",5:"พ.ค.",6:"มิ.ย.",
        7:"ก.ค.",8:"ส.ค.",9:"ก.ย.",10:"ต.ค.",11:"พ.ย.",12:"ธ.ค."
    }

    # หาปี/เดือนอ้างอิง (ใช้เดือนที่เลือกดูอยู่ หรือเดือนปัจจุบันถ้าดูทั้งปี)
    ref_year = year
    ref_month = month if month else datetime.now().month

    months_range = []
    y, m = ref_year, ref_month 
    for _ in range(6):
        months_range.append((y, m))
        m -= 1 
        if m == 0:
            m = 12
            y -= 1
    months_range.reverse() #เรียงเก่าไปใหม่

    trend_apps = [name for name, _ in app_entries[:5] if name != "อื่นๆ"]
    trend_data = {app: [] for app in trend_apps}
    trend_data["อื่นๆ"] = []
    month_labels = []
    month_totals = []

    range_start_y, range_start_m = months_range[0]
    range_end_y, range_end_m = months_range[-1]
    range_start = f"{range_start_y:04d}-{range_start_m:02d}-01"
    end_next_y, end_next_m = (range_end_y + 1, 1) if range_end_m == 12 else (range_end_y, range_end_m + 1)
    range_end = f"{end_next_y:04d}-{end_next_m:02d}-01"

    range_events = (
        db.query(ConferenceEvent)
        .filter(ConferenceEvent.deleted_at.is_(None))
        .filter(ConferenceEvent.date >= range_start)
        .filter(ConferenceEvent.date < range_end)
        .all()
    )
    events_by_month = {}
    for e in range_events:
        prefix = str(e.date)[:7]  # "YYYY-MM"
        events_by_month.setdefault(prefix, []).append(e)

    for (yy, mm) in months_range:
        month_labels.append(f"{THAI_MONTH_SHORT[mm]} {str(yy)[-2:]}")
        month_events = events_by_month.get(f"{yy:04d}-{mm:02d}", [])
        month_app_count = {}
        for e in month_events:
            a = normalize_app_name(e.app)
            month_app_count[a] = month_app_count.get(a, 0) + 1

        month_total = 0
        for app in trend_apps:
            c = month_app_count.get(app, 0)
            trend_data[app].append(c)
            month_total += c
        other_c = sum(v for k, v in month_app_count.items() if k not in trend_apps)
        trend_data["อื่นๆ"].append(other_c)
        month_total += other_c
        month_totals.append(month_total)

    trend_max = max([max(v) for v in trend_data.values()] + [1])
    # ปัดเศษแกน Y ให้กลม
    trend_axis_max = trend_max + (10 - trend_max % 10) if trend_max % 10 else trend_max
    if trend_axis_max == 0:
        trend_axis_max = 10

    _TREND_COLORS = {
        trend_apps[0] if len(trend_apps) > 0 else "": "#1B5E20",
        trend_apps[1] if len(trend_apps) > 1 else "": "#5E35B1",
        trend_apps[2] if len(trend_apps) > 2 else "": "#039BE5",
        trend_apps[3] if len(trend_apps) > 3 else "": "#FB8C00",
        trend_apps[4] if len(trend_apps) > 4 else "": "#616161",
        "อื่นๆ": "#9E9E9E",
    }        
    trend_series_order = trend_apps + ["อื่นๆ"]

    # ===== สร้าง SVG line chart ====
    CHART_W, CHART_H = 620, 320
    PAD_L, PAD_R, PAD_T, PAD_B = 26, 14, 26, 36
    plot_w = CHART_W - PAD_L - PAD_R
    plot_h = CHART_H - PAD_T - PAD_B
    n_points = len(months_range)

    def _x(i):
        return PAD_L + (plot_w * i/ (n_points - 1) if n_points > 1 else 0)

    def _y(val):
        return PAD_T + plot_h - (val / trend_axis_max * plot_h)

    svg_gridlines = "".join(
        f'<line x1="{PAD_L}" y1="{_y(trend_axis_max*f)}" x2="{CHART_W-PAD_R}" y2="{_y(trend_axis_max*f)}" stroke="#eee" stroke-width="1"/>'
        f'<text x="0" y="{_y(trend_axis_max*f)+5}" font-size="14" fill="#999">{round(trend_axis_max*f)}</text>'
        for f in [0, 0.25, 0.5, 0.75, 1]
    )

    svg_xlabels = "".join(
        f'<text x="{_x(i)}" y="{CHART_H-12}" font-size="14" fill="#666" text-anchor="middle">{esc(month_labels[i])}</text>'
        for i in range(n_points)
    )

    svg_lines = ""
    for app in trend_series_order:
        vals = trend_data.get(app, [0]*n_points)
        if sum(vals) == 0:
            continue
        color = _TREND_COLORS.get(app, "#999")
        points = " ".join(f"{_x(i):.1f}, {_y(vals[i]):.1f}" for i in range(n_points))
        dots = "".join(
            f'<circle cx="{_x(i):.1f}" cy="{_y(vals[i]):.1f}" r="4.5" fill="{color}"/>'
            + (f'<text x="{_x(i):.1f}" y="{_y(vals[i])-11:.1f}" font-size="14" fill="{color}" text-anchor="middle" font-weight="700">{vals[i]}</text>' if trend_apps and app == trend_apps[0] and vals[i] > 0 else "")
            for i in range(n_points)
        )
        svg_lines += f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="3.5"/>' + dots

    svg_chart = f'''<svg viewBox="0 0 {CHART_W} {CHART_H}" style="width:100%;height:auto">
      {svg_gridlines}
      {svg_lines}
      {svg_xlabels}
    </svg>'''

    # ==== Legend ==== 
    trend_legend = "".join(
        f'<div class="trend-legend-item"><span class="trend-legend-dot" style="background:{_TREND_COLORS.get(app,"#999")}"></span>{esc(app)}</div>'
        for app in trend_series_order if sum(trend_data.get(app, [0])) > 0 
    )  

    # ==== ตารางงานสรุป ==== 
    trend_table_rows = ""
    for app in trend_series_order:
        vals = trend_data.get(app, [0]*n_points)
        if sum(vals) == 0:
            continue
        row_total = sum(vals)
        cells = "".join(f"<td>{v}</td>" for v in vals)
        trend_table_rows += f"<tr><td class='trend-table-app'>{esc(app)}</td>{cells}<td><b>{row_total}</b></td></tr>"

    trend_table_totals = "".join(f"<td><b>{t}</b></td>" for t in month_totals)
    grand_total = sum(month_totals)    


    html = f"""<!DOCTYPE html>
  <html lang="th"><head>
  <meta charset="UTF-8"/>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>รายงานสรุป  - {scope}</title>
  <style>{_BASE_STYLE}</style>
  </head><body>
  <div class="page">

    <header class="gov-header">
      <div class="gov-header-top">
        <img id="deptLogo" src="/uploads/dept_logo.png" alt="ตรากรมอุทยานแห่งชาติ" class="gov-emblem"/>
        <div class="gov-header-text">
          <h1>รายงานสรุปผลการดำเนินงานการประชุมทางไกลผ่านสื่ออิเล็กทรอนิกส์</h1>
          <p class="gov-org-name">กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช<br/>กระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม</p>
        </div>
      </div>
      <div class="gov-header-divider"><span class="gov-divider-diamond">◆</span></div>
      <div class="gov-header-meta">
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">ช่วงข้อมูล</span><strong>{scope}</strong></div>
        </div>
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">จำนวนรายการ</span><strong>{total} รายการ</strong></div>
        </div>
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">จัดทำเมื่อ</span><strong>{prepared_date}</strong></div>
        </div>
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">เวลา</span><strong>{prepared_time}</strong></div>
        </div>
      </div>
      <button class="print-btn" onclick="printWhenReady()"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>พิมพ์รายงาน</button>
    </header>

    <div class="section">
      <div class="chart-card chart-card-formal">
        <div class="chart-title2">
          <span class="section-icon"></span>
          <span class="section-num">1.</span> ตัวชี้วัดผลการดำเนินงาน <span class="chart-en">Key Performance Indicators</span>
        </div>
        <div class="kpi-row2">
          <div class="kpi-box2">
            <div class="kpi-body2">
              <div class="kpi-lbl2">การประชุมทั้งหมด<span class="kpi-en">Total Meetings</span></div>
              <div class="kpi-num2">{total}<span class="kpi-unit">ครั้ง</span></div>
            </div>
          </div>
          <div class="kpi-box2">
            <div class="kpi-body2">
              <div class="kpi-lbl2">เวลาเฉลี่ยต่อครั้ง<span class="kpi-en">Average Duration</span></div>
              <div class="kpi-num2">{avg_min}<span class="kpi-unit">นาที</span></div>
            </div>
          </div>
          <div class="kpi-box2">
            <div class="kpi-body2">
              <div class="kpi-lbl2">พร้อมดำเนินการ<span class="kpi-en">On-time Rate</span></div>
              <div class="kpi-num2">{ready_pct}<span class="kpi-unit">%</span></div>
            </div>
          </div>
          <div class="kpi-box2">
            <div class="kpi-body2">
              <div class="kpi-lbl2">หน่วยงานที่เข้าร่วม<span class="kpi-en">Departments</span></div>
              <div class="kpi-num2">{dept_count}<span class="kpi-unit">หน่วยงาน</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="chart-card chart-card-formal">
        <div class="chart-title2">
          <span class="section-icon"></span>
          <span class="section-num">2.</span> สถิติการใช้งานแพลตฟอร์มประชุมออนไลน์ <span class="chart-en">Platform Usage</span>
        </div>

        <div class="usage-row">
          <div class="usage-block">
            <div class="app-donut-row" style="flex-direction:column;align-items:center">
              <div class="donut-chart" style="background:{donut_gradient}">
                <div class="donut-hole">
                  <div class="donut-hole-pct">{top_app_pct}%</div>
                  <div class="donut-hole-lbl">ใช้ {esc(top_app_name)}<br/>มากที่สุด</div>
                </div>
              </div>
            </div>
            <div class="app-mini-list">
              <div class="mini-list-heading">
                <span class="mini-list-heading-title">สัดส่วนการใช้งานรายแพลตฟอร์ม</span>
                <span class="mini-list-heading-unit">หน่วย: ครั้ง</span>
              </div>
              {app_row_all}
            </div>
            <div class="usage-total-note">รวม {total} ครั้ง จาก {len(app_entries)} แพลตฟอร์ม</div>
          </div>

          <div class="usage-block usage-block-divider">
            <div class="trend-header-row">
              <div class="trend-subtitle">การใช้งานแพลตฟอร์มย้อนหลัง 6 เดือน</div>
            </div>
            <div class="trend-chart-row">
              <div class="trend-chart-svg">{svg_chart}</div>
              <div class="trend-legend">{trend_legend}</div>
            </div>
            <table class="trend-table">
              <thead>
                <tr>
                  <th>แพลตฟอร์ม</th>
                  {"".join(f"<th>{esc(l)}</th>" for l in month_labels)}
                  <th>รวม</th>
                </tr>
              </thead>
              <tbody>
                {trend_table_rows}
                <tr class="trend-table-total-row">
                  <td>รวม</td>
                  {trend_table_totals}
                  <td><b>{grand_total}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="section section-page-break">
          <div class="chart-card chart-card-formal">
            <div class="chart-title2">
              <span class="section-icon"></span>
              <span class="section-num">3.</span> สรุปภาพรวม <span class="chart-en">Key Insights</span>
        </div>
        <div class="insight-list">
          <div class="insight-item insight-good">
            <span class="insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 13 10 18 19 7"/></svg></span>
            <div>
              <div class="insight-title">อัตราดำเนินการตรงเวลาอยู่ในเกณฑ์{ready_status}</div>
              <div class="insight-sub">พร้อมดำเนินการ {ready_pct}% {'สูงกว่า' if ready_pct>=80 else 'ต่ำกว่า'}เป้าหมายที่กำหนด (≥ 80%)</div>
            </div>
          </div>
          <div class="insight-item insight-info">
            <span class="insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></span>
            <div>
              <div class="insight-title">ระยะเวลาเฉลี่ยต่อครั้ง {avg_min} นาที</div>
              <div class="insight-sub">คำนวณจากการประชุมทั้งหมดในช่วง{scope}</div>
            </div>
          </div>
          <div class="insight-item insight-purple">
            <span class="insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="9" y1="6" x2="9.01" y2="6"/><line x1="15" y1="6" x2="15.01" y2="6"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/><line x1="10" y1="22" x2="10" y2="18"/><line x1="14" y1="22" x2="14" y2="18"/></svg></span>
            <div>
              <div class="insight-title">มีหน่วยงานเข้าร่วม {dept_count} หน่วยงาน</div>
              <div class="insight-sub">หน่วยงานที่เข้าร่วมมากที่สุดคือ {esc(dept_entries[0][0]) if dept_entries else '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="chart-card chart-card-formal">
        <div class="chart-title2">
          <span class="section-icon"></span>
          <span class="section-num">4.</span> วันที่มีการประชุมบ่อย <span class="chart-en">(จำนวนครั้งของการประชุม จำแนกตามวันในสัปดาห์)</span>
        </div>

        <div class="day-summary-row">
          <div class="day-total-box">
            <span class="day-total-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
            รวมทั้งสิ้น <b>{day_total}</b> ครั้ง
          </div>
          <div class="day-peak-box">
            <span class="day-peak-star">* สูงสุด</span>
            วัน{max_day_name} {day_count[max_day_idx] if max_day_idx is not None else 0} ครั้ง ({max_day_pct}%)
          </div>
        </div>

        <div class="day-chart-wrap">
          <div class="day-yaxis">
            <span class="day-yaxis-unit">ครั้ง</span>
            <span class="day-ytick">{day_axis_max}</span>
            <span class="day-ytick">{round(day_axis_max*0.75)}</span>
            <span class="day-ytick">{round(day_axis_max*0.5)}</span>
            <span class="day-ytick">{round(day_axis_max*0.25)}</span>
            <span class="day-ytick">0</span>
          </div>
          <div class="day-chart">
            <div class="day-chart-gridline" style="top:0%"></div>
            <div class="day-chart-gridline" style="top:25%"></div>
            <div class="day-chart-gridline" style="top:50%"></div>
            <div class="day-chart-gridline" style="top:75%"></div>
            {day_cols}
          </div>
        </div>

        <table class="day-summary-table">
          <thead>
            <tr>
              <th>วัน</th>
              {"".join(f"<th>{d}</th>" for d in DAYS_TH)}
              <th>รวม</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>จำนวนครั้ง (ครั้ง)</td>
              {"".join(f"<td>{c}</td>" for c in day_count)}
              <td><b>{day_total}</b></td>
            </tr>
            <tr>
              <td>ร้อยละ</td>
              {"".join(f"<td{' class=\"is-max-cell\"' if i == max_day_idx else ''}>{round(c/day_total*100,1) if day_total else 0}%</td>" for i,c in enumerate(day_count))}
              <td><b>100%</b></td>
            </tr>
          </tbody>
        </table>
        <div class="day-note">หมายเหตุ: คำนวณจากจำนวนการประชุมทั้งหมด</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title2">
        <span class="section-icon"></span>
        <span class="section-num">5.</span> รายการประชุม ({total} รายการ) <span class="section-en">Meeting List</span>
      </div>
      <div class="table-card">
        <table>
          <thead><tr>
        <th>วันที่</th><th>เวลา</th><th>ชื่อการประชุม</th><th>หน่วยงาน</th><th>App</th><th>สถานะ</th>
      </tr></thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>
</div>

<footer class="gov-signature">
  <div class="sign-box">
    <p class="sign-line">ลงชื่อ ...................................................</p>
    <p class="sign-name">( ................................................... )</p>
    <p class="sign-role">ผู้จัดทำรายงาน</p>
    <p class="sign-position">ตำแหน่ง ...................................................</p>
    <p class="sign-date">วันที่ ......... / ......... / .........</p>
  </div>
  <div class="sign-box">
    <p class="sign-line">ลงชื่อ ...................................................</p>
    <p class="sign-name">( ................................................... )</p>
    <p class="sign-role">ผู้ตรวจสอบ / รับรองผลการดำเนินงาน</p>
    <p class="sign-position">ตำแหน่ง ...................................................</p>
    <p class="sign-date">วันที่ ......... / ......... / .........</p>
  </div>
</footer>

<div class="footer">
  <span>จัดทำโดยระบบตารางการประชุมทางไกล กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช</span>
  <span>พิมพ์เมื่อ {datetime.now().strftime('%d/%m/%Y %H:%M น.')}</span>
</div>
</div>
<script>
function printWhenReady(){{
  var img = document.getElementById('deptLogo');
  if (img && !img.complete) {{
    img.addEventListener('load', function(){{ window.print(); }}, {{once:true}});
    img.addEventListener('error', function(){{ window.print(); }}, {{once:true}});
    setTimeout(function(){{ window.print(); }}, 1500);
  }} else {{
    window.print();
  }}
}}
</script>
</body></html>"""

    return HTMLResponse(content=html)

#----------------
#GET /report/print - ปริ้นตาราง
#----------------
@router.get("/print", response_class=HTMLResponse)
def report_print(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    week_start: Optional[str] = Query(None),
    week_end:   Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ConferenceEvent).filter(ConferenceEvent.deleted_at.is_(None))

    if week_start and week_end:
        q = q.filter(ConferenceEvent.date >= week_start).filter(ConferenceEvent.date <= week_end)
        scope = f"สัปดาห์ {format_date_th(week_start, short=True)} - {format_date_th(week_end, short=True)}"
    elif month:
        q = q.filter(extract("year", ConferenceEvent.date) == year)
        q = q.filter(extract("month", ConferenceEvent.date) == month)
        scope = f"เดือน{MONTHS_TH.get(month,'')} พ.ศ. {year}"
    else:
        q = q.filter(extract("year", ConferenceEvent.date) == year)
        scope = f"ปี พ.ศ. {year}"

    events = q.order_by(ConferenceEvent.date).all()
    total = len(events)

    rows_html = "".join(f"""
        <tr>
          <td>{esc(format_date_th(str(e.date), short=True))}</td>
          <td class="day-{_day_key(e.date)}">{esc(_day_full(e.date))}</td>
          <td>{esc(e.time_raw or '-')}</td>
          <td>{esc(e.title or '-')}</td>
          <td>{esc(e.department or '-')}</td>
          <td>{esc(e.location or '-')}</td>
          <td>{esc(e.app or '-')}</td>
          <td>{esc(e.assignee or '-')}</td>
          <td><span class="pill status-{get_status_cls(e.status)}">{esc(get_status_label(e.status))}</span> </td>
        </tr>""" for e in events)
    
    now = datetime.now()
    prepared_date = f"{now.day} {MONTHS_TH[now.month]} {ce_to_be_year(now.year)}"
    prepared_time = now.strftime('%H:%M')

    html = f"""<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>ตารางประชุม - {scope}</title>
<style>{_BASE_STYLE}
  .day-sun{{color:#C62828;font-weight:700}}
  .day-mon{{color:#E65100;font-weight:700}}
  .day-tue{{color:#AD1457;font-weight:700}}
  .day-wed{{color:#1B5E20;font-weight:700}}
  .day-thu{{color:#4527A0;font-weight:700}}
  .day-fri{{color:#1565C0;font-weight:700}}
  .day-sat{{color:#6A1B9A;font-weight:700}}
</style>
</head><body>
<div class="page">
<header class="gov-header">
  <div class="gov-header-top">
    <img id="deptLogo" src="/uploads/dept_logo.png" alt="ตรากรมอุทยานแห่งชาติ" class="gov-emblem"/>
    <div class="gov-header-text">
      <h1>ตารางประชุมทางไกลผ่านสื่ออิเล็กทรอนิกส์</h1>
      <p class="gov-org-name">กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช<br/>กระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม</p>
    </div>
  </div>
  <div class="gov-header-divider"><span class="gov-divider-diamond">◆</span></div>
      <div class="gov-header-meta">
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">ช่วงข้อมูล</span><strong>{scope}</strong></div>
        </div>
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">จำนวนรายการ</span><strong>{total} รายการ</strong></div>
        </div>
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M9 16l2 2 4-4"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">จัดทำเมื่อ</span><strong>{prepared_date}</strong></div>
        </div>
        <div class="gov-meta-item">
          <span class="gov-meta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></span>
          <div class="gov-meta-text"><span class="gov-meta-label">เวลา</span><strong>{prepared_time}</strong></div>
        </div>
      </div>
    <button class="print-btn" onclick="printWhenReady()"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>พิมพ์ตาราง</button>
</header>

<div class="section">
  <div class="section-title2">รายการประชุม</div>
  <div class="table-card">
  <table>
    <thead><tr>
      <th>วันที่</th><th>วัน</th><th>เวลา</th><th>ชื่อการประชุม</th>
      <th>หน่วยงาน</th><th>สถานที่</th><th>App</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th>
    </tr></thead>
    <tbody>{rows_html}</tbody>
  </table>
  </div>
</div>

<div class="footer">
  จัดทำโดยระบบตารางการประชุมทางไกล กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช<br/>
  พิมพ์เมื่อ {datetime.now().strftime('%d/%m/%Y %H:%M น.')}
</div>
</div>
<script>
function printWhenReady(){{
  var img = document.getElementById('deptLogo');
  if (img && !img.complete) {{
    img.addEventListener('load', function(){{ window.print(); }}, {{once:true}});
    img.addEventListener('error', function(){{ window.print(); }}, {{once:true}});
    setTimeout(function(){{ window.print(); }}, 1500);
  }} else {{
    window.print();
  }}
}}
</script>



</body></html>"""

    return HTMLResponse(content=html)