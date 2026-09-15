import { useState } from "react";
import { ceToBeYear, beToCeYear } from "./utils/dateUtils";
import Icon from "./Icon";
import "./CalendarPicker.css";


const MONTHS_TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const MONTHS_TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const DAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function pad2(n) { return String(n).padStart(2, "0"); }

function normalizeYear(y) {
  if (y < 100) return y + 2500;      // "69" -> 2569
  if (y < 2400) return ceToBeYear(y); // ค.ศ. -> พ.ศ.
  return y;
}

function isValidYMD(y, m, d) {
  if (!y || !m || !d || m < 1 || m > 12) return false;
  const daysInMonth = new Date(beToCeYear(y), m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}

/* แปลงข้อความที่พิมพ์ → "YYYY-MM-DD" (พ.ศ.) รองรับ:
   2569-09-05 | 5/9/2569 | 5-9-69 | 5 ก.ย. 2569 | 5 กันยายน 2569
   แปลง ค.ศ. เป็น พ.ศ. ให้อัตโนมัติถ้าปีดูเป็น ค.ศ. (< 2400) */
function parseDateText(raw) {
  const text = (raw || "").trim();
  if (!text) return null;

  let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = normalizeYear(parseInt(m[1]));
    const mo = parseInt(m[2]);
    const d = parseInt(m[3]);
    return isValidYMD(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }

  m = text.match(/^(\d{1,2})\s+([ก-๙.]+)\s+(\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1]);
    const monthText = m[2].replace(/\.$/, "");
    let mo = MONTHS_TH.findIndex((x) => x === monthText || x.startsWith(monthText)) + 1;
    if (!mo) mo = MONTHS_TH_ABBR.findIndex((x) => x.replace(".", "") === monthText.replace(".", "")) + 1;
    const y = normalizeYear(parseInt(m[3]));
    return mo && isValidYMD(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }

  m = text.match(/^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1]);
    const mo = parseInt(m[2]);
    const y = normalizeYear(parseInt(m[3]));
    return isValidYMD(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null;
  }

  return null;
}

// value/onChange ใช้รูปแบบวันที่ พ.ศ. เสมอ "YYYY-MM-DD" (ให้ตรงกับที่ event.date เก็บในระบบ)
export function ThaiDatePicker({ label, value, onChange, placeholder = "พิมพ์ เช่น 5/9/2569 หรือกดปฏิทิน" }) {
  const today = new Date();
  const todayYearBe = ceToBeYear(today.getFullYear());
  const [yBe, mStr, dStr] = (value || "").split("-");
  const initialYearBe = parseInt(yBe) || todayYearBe;
  const initialMonth = parseInt(mStr) || today.getMonth() + 1;

  const [open, setOpen] = useState(false);
  const [viewYearBe, setViewYearBe] = useState(initialYearBe);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  function toggleOpen() {
    setOpen(o => {
      if (!o) {
        const [y, m] = (value || "").split("-");
        setViewYearBe(parseInt(y) || todayYearBe);
        setViewMonth(parseInt(m) || today.getMonth() + 1);
      }
      return !o;
    });
  }

  const ceYear = beToCeYear(viewYearBe);
  const firstDay = new Date(ceYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(ceYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedStr = value || "";
  const todayStr = `${todayYearBe}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const yearOptions = Array.from({ length: 21 }, (_, i) => todayYearBe - 10 + i);

  function pickDay(d) {
    onChange(`${viewYearBe}-${pad2(viewMonth)}-${pad2(d)}`);
    setOpen(false);
  }

  const displayText = value && parseInt(dStr)
    ? `${parseInt(dStr)} ${MONTHS_TH[initialMonth - 1] || ""} ${initialYearBe}`
    : "";

  const [text, setText] = useState(displayText);
  const [syncedText, setSyncedText] = useState(displayText);
  if (displayText !== syncedText) {
    setSyncedText(displayText);
    setText(displayText);
  }

  function commitTyped() {
    const parsed = parseDateText(text);
    if (parsed) onChange(parsed);
    else setText(displayText); // พิมพ์ไม่ใช่วันที่ที่อ่านได้ → กลับไปค่าเดิม
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitTyped();
    }
  }

  return (
    <div className="thai-date-picker">
      {label && <label className="form-label">{label}</label>}
      <div className="thai-date-picker-display">
        <input
          type="text"
          className="form-input thai-date-picker-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="done"
        />
        <div className="thai-date-picker-field-btns">
          {value && (
            <button
              type="button"
              className="thai-date-picker-icon-btn thai-date-picker-clear"
              onClick={() => { onChange(""); setText(""); }}
              title="ล้างวันที่"
              aria-label="ล้างวันที่"
            >
              <Icon name="x" size={16} />
            </button>
          )}
          <button
            type="button"
            className="thai-date-picker-icon-btn thai-date-picker-open"
            onClick={toggleOpen}
            title="เลือกวันที่"
            aria-label="เปิดปฏิทิน"
          >
            <Icon name="calendar" size={18} />
          </button>
        </div>
      </div>

      {open && (
        // sheet เต็มจอแบบ fixed (เหมือน picker อื่นๆ ในแอป) แทน dropdown แบบ absolute เดิม
        // เพราะฟอร์มอยู่ใน .app-body ที่เป็น overflow-y:auto — dropdown แบบ absolute จะโดนตัดครึ่งล่างเวลาป๊อปอัปเกินขอบเขต scroll ของ ancestor
        <div className="sheet-overlay" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="calendar__opts">
              <select value={viewMonth} onChange={e => setViewMonth(parseInt(e.target.value))}>
                {MONTHS_TH.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={viewYearBe} onChange={e => setViewYearBe(parseInt(e.target.value))}>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div className="calendar__body">
              <div className="calendar__days">
                {DAYS_SHORT.map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="calendar__dates">
                {cells.map((d, i) => {
                  if (!d) return <div key={`x${i}`} />;
                  const ds = `${viewYearBe}-${pad2(viewMonth)}-${pad2(d)}`;
                  const isSelected = ds === selectedStr;
                  const isToday = ds === todayStr;
                  return (
                    <div
                      key={i}
                      className={`calendar__date ${isSelected ? "calendar__date--selected" : ""}`}
                      style={isToday && !isSelected ? { borderColor: "#1B5E20", fontWeight: 700 } : undefined}
                      onClick={() => pickDay(d)}>
                      <span>{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="calendar__buttons">
              <button type="button" className="calendar__button calendar__button--grey" onClick={() => setOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
