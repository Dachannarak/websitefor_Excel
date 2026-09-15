import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";
import { parseTimeRange } from "../utils/date";

/* ─────────────────────────────────────────────────────────────────────
   TimePickerScroll — ช่องเวลา (พิมพ์เองได้) + หน้าต่างเลือกเวลา

   1) พิมพ์ในช่องได้อิสระ เช่น  9.30-12 | 0930 1200 | 13:00 ถึง 16:30
      ออกจากช่องหรือกด Enter แล้วจัดรูปแบบเป็น "09:30 - 12:00 น." ให้เอง
      ถ้าพิมพ์ข้อความที่ไม่ใช่เวลา (เช่น "ตามนัดหมาย") จะเก็บตามที่พิมพ์
   2) ปุ่มนาฬิกาเปิดหน้าต่างเลือกเวลา
      - ช่วงที่ใช้บ่อย / เวลาเริ่ม / ระยะเวลา (เวลาสิ้นสุดคำนวณให้)
      - "ปรับละเอียด" เปิดล้อหมุนสำหรับเวลาที่ไม่มีในปุ่ม

   props เหมือนเดิม: value, onChange(timeString), label
   ───────────────────────────────────────────────────────────────────── */

/* ปรับตัวเลือกด่วนได้ที่นี่ (หน่วย: นาทีนับจาก 00:00) */
const PRESETS = [
  { label: "ช่วงเช้า", start: 9 * 60, end: 12 * 60 },
  { label: "ช่วงบ่าย", start: 13 * 60, end: 16 * 60 + 30 },
  { label: "ทั้งวัน", start: 9 * 60, end: 16 * 60 + 30 },
];
const START_TIMES = makeRange(8 * 60, 16 * 60, 30); // 08:00–16:00 ทุก 30 นาที
const DURATIONS = [30, 60, 90, 120, 180, 240];

/* ความสูงแถวของล้อหมุน — JS เป็นตัวกำหนดทั้งหมด (แถว, spacer, กรอบ)
   เพื่อไม่ให้ CSS บนมือถือทำให้ตำแหน่งเพี้ยนอีก */
const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const MAX_MINUTES = 23 * 60 + 59;

function makeRange(from, to, step) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

const pad2 = (n) => String(n).padStart(2, "0");
const clampMinutes = (v) => Math.min(Math.max(v, 0), MAX_MINUTES);
const toClock = (mins) => `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`;
const formatRange = (start, end) => `${toClock(start)} - ${toClock(end)} น.`;

function durationText(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} นาที`;
  if (m === 0) return `${h} ชม.`;
  if (m === 30) return `${h}.5 ชม.`;
  return `${h} ชม. ${m} นาที`;
}

/* แปลงเวลา 1 ค่าที่พิมพ์ → นาที (null = ไม่ใช่เวลา)
   รองรับ: 9 | 09 | 9.30 | 9:30 | 9.3 (=9:30) | 930 | 0930 | 9 30 */
function parseClock(part) {
  const p = part.replace(/นาฬิกา|น\.?/g, "").trim();
  if (!p) return null;
  let h;
  let m;
  let match;
  if ((match = p.match(/^(\d{1,2})\s*[.:]\s*(\d{1,2})$/))) {
    h = Number(match[1]);
    m = match[2].length === 1 ? Number(match[2]) * 10 : Number(match[2]);
  } else if ((match = p.match(/^(\d{1,2})$/))) {
    h = Number(match[1]);
    m = 0;
  } else if ((match = p.match(/^(\d{3,4})$/))) {
    const v = match[1].padStart(4, "0");
    h = Number(v.slice(0, 2));
    m = Number(v.slice(2));
  } else if ((match = p.match(/^(\d{1,2})\s+(\d{2})$/))) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else {
    return null;
  }
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/* จัดรูปแบบข้อความที่พิมพ์ให้เป็นมาตรฐาน "HH:MM - HH:MM น."
   ถ้าอ่านเป็นเวลาไม่ได้ → คืนข้อความเดิม (ไม่ทำข้อมูลหาย) */
function normalizeTimeText(raw) {
  const text = (raw || "").trim();
  if (!text) return "";

  let parts = text.split(/\s*(?:-|–|—|~|ถึง)\s*/).filter(Boolean);
  if (parts.length === 1) {
    const pair = text.match(/^(\d{3,4})\s+(\d{3,4})$/); // "0930 1200"
    if (pair) parts = [pair[1], pair[2]];
  }
  if (parts.length === 0 || parts.length > 2) return text;

  const mins = parts.map(parseClock);
  if (mins.some((v) => v === null)) return text;

  if (mins.length === 1) return `${toClock(mins[0])} น.`;
  return formatRange(mins[0], mins[1]);
}

export function TimePickerScroll({ value = "", onChange, label = "เวลา" }) {
  const [showPicker, setShowPicker] = useState(false);
  const [showWheels, setShowWheels] = useState(false);
  const [start, setStart] = useState(9 * 60);
  const [end, setEnd] = useState(10 * 60);
  const wheelsRef = useRef(null);

  const duration = end - start;
  const isValid = duration > 0;

  /* ---------- ช่องพิมพ์ ---------- */
  function handleInputChange(e) {
    onChange(e.target.value);
  }

  function commitTyped() {
    const normalized = normalizeTimeText(value);
    if (normalized !== value) onChange(normalized);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault(); // ไม่ให้ Enter ส่งฟอร์ม
      commitTyped();
    }
  }

  /* ---------- หน้าต่างเลือกเวลา ---------- */
  function openPicker() {
    const { start: s, end: e } = parseTimeRange(normalizeTimeText(value));
    setStart(clampMinutes(s));
    setEnd(clampMinutes(e));
    setShowWheels(false);
    setShowPicker(true);
  }

  function closePicker() {
    setShowPicker(false);
  }

  function confirm() {
    if (!isValid) return;
    onChange(formatRange(start, end));
    setShowPicker(false);
  }

  function clear() {
    onChange("");
    setShowPicker(false);
  }

  function pickPreset(preset) {
    setStart(preset.start);
    setEnd(preset.end);
  }

  function pickStart(newStart) {
    const keep = duration > 0 ? duration : 60; // เปลี่ยนเวลาเริ่ม แต่คงระยะเวลาเดิม
    setStart(newStart);
    setEnd(clampMinutes(newStart + keep));
  }

  function pickDuration(mins) {
    setEnd(clampMinutes(start + mins));
  }

  // ปิดด้วยปุ่ม Esc
  useEffect(() => {
    if (!showPicker) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setShowPicker(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPicker]);

  // กาง "ปรับละเอียด" แล้วเลื่อนให้เห็นล้อหมุน
  useEffect(() => {
    if (showWheels && wheelsRef.current) {
      wheelsRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [showWheels]);

  return (
    <div className="time-picker-scroll-wrap">
      <label className="form-label">{label}</label>

      {/* ช่องเวลา: พิมพ์เองได้ + ปุ่มล้าง + ปุ่มนาฬิกา */}
      <div className="time-picker-scroll-display">
        <input
          type="text"
          className="form-input time-picker-scroll-input"
          value={value}
          onChange={handleInputChange}
          onBlur={commitTyped}
          onKeyDown={handleKeyDown}
          placeholder="พิมพ์ เช่น 9.30-12.00 หรือกดนาฬิกา"
          autoComplete="off"
          enterKeyHint="done"
        />
        <div className="time-picker-scroll-field-btns">
          {value && (
            <button
              type="button"
              className="time-picker-scroll-icon-btn time-picker-scroll-clear"
              onClick={() => onChange("")}
              title="ล้างเวลา"
              aria-label="ล้างเวลา"
            >
              <Icon name="x" size={16} />
            </button>
          )}
          <button
            type="button"
            className="time-picker-scroll-icon-btn time-picker-scroll-open"
            onClick={openPicker}
            title="เลือกเวลา"
            aria-label="เปิดตัวเลือกเวลา"
          >
            <Icon name="clock" size={18} />
          </button>
        </div>
      </div>

      {showPicker && (
        <div className="time-picker-scroll-modal-overlay" onClick={closePicker}>
          <div
            className="time-picker-scroll-modal"
            role="dialog"
            aria-modal="true"
            aria-label="เลือกเวลา"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="time-picker-scroll-header">
              <button type="button" className="time-picker-scroll-header-close" onClick={closePicker}>
                ยกเลิก
              </button>
              <div className="time-picker-scroll-header-title">เลือกเวลา</div>
              <button
                type="button"
                className="time-picker-scroll-header-done"
                onClick={confirm}
                disabled={!isValid}
              >
                ตกลง
              </button>
            </div>

            <div className="tpq">
              {/* ช่วงที่ใช้บ่อย */}
              <div className="tpq-group">
                <div className="tpq-group-label">ช่วงที่ใช้บ่อย</div>
                <div className="tpq-grid tpq-grid-3">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`tpq-chip ${start === p.start && end === p.end ? "on" : ""}`}
                      onClick={() => pickPreset(p)}
                    >
                      {p.label}
                      <small>
                        {toClock(p.start)}–{toClock(p.end)}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              {/* เวลาเริ่ม */}
              <div className="tpq-group">
                <div className="tpq-group-label">เวลาเริ่ม</div>
                <div className="tpq-grid tpq-grid-4">
                  {START_TIMES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`tpq-chip ${start === m ? "on" : ""}`}
                      onClick={() => pickStart(m)}
                    >
                      {toClock(m)}
                    </button>
                  ))}
                </div>
              </div>

              {/* ระยะเวลา */}
              <div className="tpq-group">
                <div className="tpq-group-label">
                  ระยะเวลา
                  <small className={isValid ? "" : "tpq-warn"}>
                    {isValid ? `รวม ${durationText(duration)}` : "เวลาสิ้นสุดต้องหลังเวลาเริ่ม"}
                  </small>
                </div>
                <div className="tpq-grid tpq-grid-3">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`tpq-chip ${duration === d ? "on" : ""}`}
                      onClick={() => pickDuration(d)}
                    >
                      {durationText(d)}
                    </button>
                  ))}
                </div>
              </div>

              {/* ปรับละเอียดด้วยล้อหมุน */}
              <button
                type="button"
                className={`tpq-more ${showWheels ? "open" : ""}`}
                onClick={() => setShowWheels((v) => !v)}
                aria-expanded={showWheels}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
                ปรับละเอียด (ล้อหมุน)
              </button>

              {/* mount เฉพาะตอนกาง เพื่อให้ตั้งตำแหน่งล้อถูกต้องทุกครั้ง */}
              {showWheels && (
                <div className="time-picker-scroll-body" ref={wheelsRef}>
                  <div className="time-picker-scroll-section">
                    <div className="time-picker-scroll-label-text">เริ่มต้น</div>
                    <div className="time-picker-scroll-inputs">
                      <ScrollWheel
                        label="ชั่วโมง"
                        value={Math.floor(start / 60)}
                        onChange={(h) => pickStart(clampMinutes(h * 60 + (start % 60)))}
                        min={0}
                        max={23}
                      />
                      <div className="time-picker-scroll-sep">:</div>
                      <ScrollWheel
                        label="นาที"
                        value={start % 60}
                        onChange={(m) => pickStart(clampMinutes(Math.floor(start / 60) * 60 + m))}
                        min={0}
                        max={59}
                      />
                    </div>
                  </div>

                  <div className="time-picker-scroll-dash">-</div>

                  <div className="time-picker-scroll-section">
                    <div className="time-picker-scroll-label-text">สิ้นสุด</div>
                    <div className="time-picker-scroll-inputs">
                      <ScrollWheel
                        label="ชั่วโมง"
                        value={Math.floor(end / 60)}
                        onChange={(h) => setEnd((e) => h * 60 + (e % 60))}
                        min={0}
                        max={23}
                      />
                      <div className="time-picker-scroll-sep">:</div>
                      <ScrollWheel
                        label="นาที"
                        value={end % 60}
                        onChange={(m) => setEnd((e) => Math.floor(e / 60) * 60 + m)}
                        min={0}
                        max={59}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`time-picker-scroll-preview ${isValid ? "" : "is-invalid"}`}>
              {formatRange(start, end)}
            </div>

            <div className="time-picker-scroll-actions">
              <button type="button" className="time-picker-scroll-btn-clear" onClick={clear}>
                ล้างเวลา
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScrollWheel({ value, onChange, min, max, label }) {
  const scrollRef = useRef(null);
  const ignoreNextScroll = useRef(false); // scroll ที่เกิดจากโค้ดตั้งตำแหน่งเอง
  const userScrolling = useRef(false); // ผู้ใช้กำลังเลื่อนอยู่ → ห้ามดึงล้อกลับ
  const idleTimer = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  function alignTo(v) {
    const el = scrollRef.current;
    if (!el) return;
    const target = (v - min) * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) < 1) return;
    ignoreNextScroll.current = true;
    el.style.scrollBehavior = "auto"; // ไม่ animate เพื่อไม่ให้เกิด scroll event วนซ้ำ
    el.scrollTop = target;
    el.style.scrollBehavior = "";
  }

  // ตั้งตำแหน่งล้อตามค่า (ตอนเปิด / กดปุ่มเลือกด่วน / แตะตัวเลข)
  useEffect(() => {
    if (!userScrolling.current) alignTo(value);
  }, [value, min]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  // เมาส์ล้อบนคอม: 1 จังหวะ = เลื่อน 1 ค่า (ปกติเบราว์เซอร์กระโดดทีละหลายค่า)
  // จอสัมผัสยังใช้การปัดตามปกติ
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e) => {
      e.preventDefault();
      acc += e.deltaMode === 1 ? e.deltaY * ITEM_HEIGHT : e.deltaY;
      if (Math.abs(acc) < ITEM_HEIGHT * 0.6) return; // trackpad: สะสมก่อนค่อยเลื่อน
      const step = acc > 0 ? 1 : -1;
      acc = 0;
      const next = Math.min(max, Math.max(min, valueRef.current + step));
      if (next !== valueRef.current) onChangeRef.current(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [min, max]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (ignoreNextScroll.current) {
      ignoreNextScroll.current = false;
      return;
    }
    userScrolling.current = true;
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      userScrolling.current = false;
      alignTo(valueRef.current); // เลื่อนเสร็จแล้วจัดให้ตรงแถวของค่าล่าสุด
    }, 150);

    let next = Math.round(el.scrollTop / ITEM_HEIGHT) + min;
    next = Math.min(max, Math.max(min, next));
    if (next !== value) onChange(next);
  }

  const items = makeRange(min, max, 1);

  return (
    <div className="scroll-wheel-wrap">
      <div className="scroll-wheel-label">{label}</div>
      <div className="scroll-wheel-container" style={{ height: ITEM_HEIGHT * VISIBLE_ROWS }}>
        <div className="scroll-wheel" ref={scrollRef} onScroll={handleScroll}>
          <div className="scroll-wheel-spacer" style={{ height: ITEM_HEIGHT * 2 }} />
          {items.map((num) => (
            <div
              key={num}
              className={`scroll-wheel-item ${num === value ? "scroll-wheel-item-active" : ""}`}
              style={{ height: ITEM_HEIGHT }}
              onClick={() => onChange(num)}
            >
              {pad2(num)}
            </div>
          ))}
          <div className="scroll-wheel-spacer" style={{ height: ITEM_HEIGHT * 2 }} />
        </div>
        <div className="scroll-wheel-center-line" style={{ height: ITEM_HEIGHT }} />
      </div>
    </div>
  );
}
