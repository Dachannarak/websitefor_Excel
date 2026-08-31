import { useState } from "react";
import Icon from "../Icon";
import { API } from "../api/events";
import { MONTHS_TH, toDateStr, formatDateTH } from "../utils/date";
import { showToast } from "../utils/toast";

// ---------------------------------------------------------------------------
// Print Sheet — เลือกเดือน / สัปดาห์ที่จะปริ้น
// ---------------------------------------------------------------------------
export default function PrintSheet({ events, onClose }) {
  const [mode, setMode] = useState("month");

  // รวบเดือนจากข้อมูลจริง
  const months = (() => {
    const map = {};
    events.forEach(e => {
      if (!e.date) return;
      const [y, m] = e.date.split("-");
      const key = `${y}-${m.padStart(2,"0")}`;
      if (!map[key]) map[key] = { year: parseInt(y), month: parseInt(m), count: 0 };
      map[key].count++;
    });
    return Object.values(map).sort((a,b)=>{
      const ka=`${a.year}-${String(a.month).padStart(2,"0")}`;
      const kb=`${b.year}-${String(b.month).padStart(2,"0")}`;
      return ka.localeCompare(kb);
    });
  })();

  // สัปดาห์จากข้อมูลจริง (รวม current week เสมอ)
  const today = new Date();
  const _d = new Date(today);
  _d.setDate(today.getDate() - (today.getDay()===0 ? 6 : today.getDay()-1));
  const curWeekStart = toDateStr(_d);

  function _weekStart(dateStr) {
    const d = new Date(dateStr+"T00:00:00");
    d.setDate(d.getDate() - (d.getDay()===0 ? 6 : d.getDay()-1));
    return toDateStr(d);
  }
  function _weekEnd(ws) {
    const d = new Date(ws+"T00:00:00");
    d.setDate(d.getDate()+6);
    return toDateStr(d);
  }
  const weekMap = {};
  events.forEach(e => {
    if (!e.date) return;
    const ws = _weekStart(e.date);
    if (!weekMap[ws]) weekMap[ws] = { ss: ws, es: _weekEnd(ws), count: 0, isCur: ws===curWeekStart };
    weekMap[ws].count++;
  });
  if (!weekMap[curWeekStart])
    weekMap[curWeekStart] = { ss: curWeekStart, es: _weekEnd(curWeekStart), count: 0, isCur: true };
  const weeks = Object.values(weekMap).sort((a,b)=>a.ss.localeCompare(b.ss));

  function doMonthPrint(m) {
    const url = `${API}/report/print?year=${m.year+543}&month=${m.month}`;
    window.open(url,"_blank");
    showToast("เปิดหน้าปริ้นแล้ว");
    onClose();
  }
  function doWeekPrint(w) {
    const url = `${API}/report/print?year=${w.ss.split("-")[0]}&week_start=${w.ss}&week_end=${w.es}`;
    window.open(url, "_blank");
    showToast("เปิดหน้าปริ้นแล้ว");
    onClose();
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet print-sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-title">ปริ้นตาราง</div>
        <div className="print-mode-row">
          <button className={`print-mode-btn${mode==="month"?" active":""}`} onClick={()=>setMode("month")}>เลือกเดือน</button>
          <button className={`print-mode-btn${mode==="week"?" active":""}`}  onClick={()=>setMode("week")}>เลือกสัปดาห์</button>
        </div>
        <div className="print-scroll">
          {mode==="month" && months.length===0 && <div className="print-empty">ยังไม่มีข้อมูล</div>}
          {mode==="month" && months.map(m=>(
            <button key={`${m.year}-${m.month}`} className="print-item" onClick={()=>doMonthPrint(m)}>
              <span className="print-item-label">{MONTHS_TH[m.month]} {m.year+543}</span>
              <span className="print-item-count">{m.count} รายการ</span>
              <Icon name="printer" size={15}/>
            </button>
          ))}
          {mode==="week" && weeks.map(w=>(
            <button key={w.ss} className={`print-item${w.isCur?" print-item-cur":""}`} onClick={()=>doWeekPrint(w)}>
              <span className="print-item-label">
                {w.isCur && <span className="print-item-cur-tag">สัปดาห์นี้ · </span>}
                {formatDateTH(w.ss,true)} – {formatDateTH(w.es,true)}
              </span>
              <span className="print-item-count">{w.count} รายการ</span>
              <Icon name="printer" size={15}/>
            </button>
          ))}
        </div>
        <button className="btn-sheet-close" onClick={onClose}>ปิด</button>
      </div>
    </div>
  );
}
