import { useState, useEffect } from "react";
import Icon from "../Icon";
import { MONTHS_TH, DAYS_SHORT, toDateStr, getDayCls, formatDateTH, dayOfWeekTH } from "../utils/date";
import { getEventTypeCls, getCategoryCls, getAppCls } from "../utils/eventStyle";
import { showToast } from "../utils/toast";
import { DayTimeline, MoreEventsBadge } from "./DayTimeline";
import AgendaListView from "./AgendaListView";

const APP_OPTIONS = [
  {val:"app-zoom",  label:"Zoom"},
  {val:"app-teams", label:"Teams"},
  {val:"app-meet",  label:"Google Meet"},
  {val:"app-webex", label:"Cisco Webex"},
  {val:"app-line",  label:"LINE"},
  {val:"app-other", label:"อื่นๆ"},
];

export default function CalendarScreen({ events, focusDate, onFocusDateApplied, onSelectEvent, onEventDateChange, onEventDeleted, viewMode, onViewModeChange }) {
  const today = new Date();
  const setViewMode = onViewModeChange; // "agenda" | "grid" — state อยู่ที่ App.jsx เพื่อให้กด "กลับ" จากหน้ารายละเอียดแล้วยังอยู่มุมมองเดิม ไม่รีเซ็ตกลับ "รายการ"
  const [year,   setYear]  = useState(today.getFullYear());
  const [month,  setMonth] = useState(today.getMonth()+1);
  const todayStr = toDateStr(today);
  const firstday = new Date(year,month-1,1).getDay();
  const daysInMonth = new Date(year,month,0).getDate();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);
  const [yearGridStart, setYearGridStart] = useState(() => today.getFullYear() - 5);
  const [justAddedDate, setJustAddedDate] = useState(null);
  const [openMoreDate, setOpenMoreDate] = useState(null); // วันที่ที่กำลังเปิด popup "+N" อยู่ — เปิดได้ทีละอันเท่านั้น กดอันใหม่แล้วอันเก่าปิดอัตโนมัติ

  // เปิดหน้าปฏิทินตรงเดือน/วันของรายการที่เพิ่งสร้างเสร็จ แทนที่จะรีเซ็ตกลับไปเดือนปัจจุบันเสมอ
  // สลับไปมุมมองปฏิทิน (grid) เพื่อให้เห็นตัวเลข +N ที่อัปเดต และไฮไลต์ช่องนั้นชั่วครู่ให้สังเกตง่าย
  // ซิงก์กับ focusDate ที่เป็น "คำสั่ง" จาก App.jsx (ใช้ครั้งเดียวแล้วเคลียร์ผ่าน onFocusDateApplied) พร้อมตั้ง timer ภายนอก จึงจำเป็นต้องเป็น effect
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!focusDate) return;
    const [y, m] = focusDate.split("-");
    if (y && m) { setYear(parseInt(y)); setMonth(parseInt(m)); }
    setSelectedDate(focusDate);
    setViewMode("grid");
    setJustAddedDate(focusDate);
    onFocusDateApplied?.();
    const t = setTimeout(() => setJustAddedDate(null), 2200);
    return () => clearTimeout(t);
  }, [focusDate, onFocusDateApplied, setViewMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const [updatingId, setUpdatingId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [hoverDate, setHoverDate] = useState(null);

  const [filterApp,  setFilterApp]  = useState([]);
  const [filterSt,   setFilterSt]   = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const deptList  = [...new Set(events.map(e=>e.department).filter(Boolean))].sort();
  const hasFilter = filterApp.length>0 || filterSt || filterDept || dateFrom || dateTo;
  function toggleFilterApp(val) {
    setFilterApp(arr => arr.includes(val) ? arr.filter(v=>v!==val) : [...arr, val]);
  }
  function clearCalFilter() {
    setFilterApp([]); setFilterSt(""); setFilterDept("");
    setDateFrom(""); setDateTo("");
  }

  const monthEvs = events.filter(e=>{
    const [y,m]=(e.date||"").split("-");
    if (parseInt(y)!==year || parseInt(m)!==month) return false;
    if (filterApp.length>0 && !filterApp.includes(getAppCls(e.app))) return false;
    if (filterSt) {
      const st = e.status || "";
      if (filterSt === "done" && !st.includes("สร้าง link")) return false;
      if (filterSt === "wait" && (st.includes("สร้าง link") || st.includes("ยกเลิก") || st.includes("ย้าย"))) return false;
      if (filterSt === "cancel" && !st.includes("ยกเลิก")) return false;
      if (filterSt === "moved" && !st.includes("ย้าย")) return false;
    }
    if (filterDept && e.department !== filterDept) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });
  const normDate = (s) => {
      const [y,m,d] = String (s||"").split("-");
      if (!y || !m || !d) return s;
      return `${y}-${String(parseInt(m,10)).padStart(2,"0")}-${String(parseInt(d,10)).padStart(2,"0")}`;
    };
    const byDate = monthEvs.reduce((acc,e)=>{
      const k = normDate(e.date);
      acc[k]=acc[k]||[]; acc[k].push(e); return acc;
    },{});
    const selectedEvs = byDate[normDate(selectedDate)] || [];
  const cells=[];
  for(let i=0;i<firstday;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);

  const prev=()=>{
    if(month===1){setMonth(12);setYear(y=>y-1);}else setMonth(m=>m-1);
    setSelectedDate("");
  };
  const next=()=>{
    if(month===12){setMonth(1);setYear(y=>y+1);}else setMonth(m=>m+1);
    setSelectedDate("");
  };

  async function handleDateChange(ev, newDate) {
    if (!onEventDateChange || !newDate || newDate === ev.date) return;
    setUpdatingId(ev.id);
    try {
      await onEventDateChange(ev, newDate);
      showToast(`ย้าย "${ev.title || "รายการ"}" ไป ${formatDateTH(newDate,true)}แล้ว`);
    } catch (err) {
      showToast(err?.message || "อัปเดตวันที่ไม่สำเร็จ", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  // drag บนช่องปฏิทิน (pointer events)
    function startDrag(e, ev) {
      //มือถือจอแคบ: ไม่เข้าโหมดลาก ให้กดแล้วเปิด detail ทันทีแทน
      if (window.innerWidth <= 480) {
        onSelectEvent(ev);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ ev, pointerId: e.pointerId, moved:false, startX:e.clientX, startY:e.clientY });
      setHoverDate(ev.date);
    }
    
    function onDragMove(e) {
        const cx = e.clientX, cy = e.clientY;
        setDrag(d => {
          if (!d) return d;
          if (!d.moved) {
            const dx = Math.abs(cx - d.startX);
            const dy = Math.abs(cy - d.startY);
            if (dx < 5 && dy < 5) return d; 
            return { ...d, moved:true };
          }
          return d;
        });
        const el = document.elementFromPoint(cx, cy);
        const cell = el?.closest?.("[data-cal-date]");
        setHoverDate(cell?.dataset.calDate || null);
    }
    function onDrag(e, ev) {
      e.stopPropagation();
      if (!drag) return;
      const target = hoverDate;
      const moved = drag.moved;
      setDrag(null); setHoverDate(null);
      if (moved && target && target !== ev.date) {
        handleDateChange(ev, target);
      } else if (!moved) {
        onSelectEvent(ev);
      }
    }



return (
  <div className="screen">
    <div className="cal-header-bar">
            <div className="cal-header-left">
              <div className="cal-header-title">
                {MONTHS_TH[month]} {year+543}
              </div>
              <div className="cal-header-sub">วันนี้ {formatDateTH(todayStr)}</div>
            </div>
            <div className="cal-header-right">
              <button
                className="cal-nav-btn cal-month-btn"
                onClick={()=>setShowMonthPicker(true)}
                title="เลือกเดือน/ปี"
                aria-label="เลือกเดือน/ปี">
                <Icon name="calendar" size={15}/>
                </button>
              <button
                className={`cal-nav-btn cal-filter-btn${hasFilter?" has-filter":""}`}
                onClick={()=>setShowFilter(f=>!f)}
                title="กรองรายการ"
                aria-label="กรองรายการ"
                aria-expanded={showFilter}>
                <Icon name="filter" size={15}/>
                {hasFilter && <span className="filter-dot"/>}
                </button>
              <button className="cal-nav-btn" onClick={prev} aria-label="เดือนก่อนหน้า">‹</button>
              <button className="cal-nav-btn cal-nav-today" onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth()+1);setSelectedDate(todayStr);}}>วันนี้</button>
              <button className="cal-nav-btn" onClick={next} aria-label="เดือนถัดไป">›</button>
            </div>
          </div>

          <div className="cal-view-toggle">
            <button className={`cal-view-btn${viewMode==="agenda"?" active":""}`} onClick={()=>setViewMode("agenda")}>
              <Icon name="clipboard" size={14}/> รายการ
            </button>
            <button className={`cal-view-btn${viewMode==="grid"?" active":""}`} onClick={()=>setViewMode("grid")}>
              <Icon name="calendar" size={14}/> ปฏิทิน
            </button>
          </div>
          {showFilter && (
            <div className="filter-panel cal-filter-panel">
              <div className="filter-row">
                <div className="filter-label">App</div>
                <div className="filter-chips">
                  {APP_OPTIONS.map(o=>(
                    <button key={o.val}
                      className={`chip ${filterApp.includes(o.val)?"chip-active":""}`}
                      onClick={()=>toggleFilterApp(o.val)}>
                      {o.label}
                      </button>
                  ))}
                </div>
              </div>

              <div className="filter-row">
                <div className="filter-label">สถานะ</div>
                <div className="filter-chips">
                  {[
                    {val:"",     label:"ทั้งหมด"},
                    {val:"done",     label:"พร้อมแล้ว"},
                    {val:"wait",     label:"รอดำเนินการ"},
                    {val:"cancel",     label:"ยกเลิก"},
                    {val:"moved",     label:"ย้ายวัน"},
                  ].map(o=>(
                    <button key={o.val}
                      className={`chip ${filterSt===o.val?"chip-active":""}`}
                      onClick={()=>setFilterSt(o.val)}>
                      {o.label}
                      </button>
                  ))}
                </div>
              </div>

              <div className="filter-row">
                <div className="filter-label">หน่วยงาน</div>
                <select className="filter-select"
                  value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
                  <option value="">ทั้งหมด</option>
                  {deptList.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="filter-row">
                <div className="filter-label">ช่วงวันที่</div>
                <div className="filter-date-row">
                  <input type="date" className="filter-date"
                    value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
                  <span className="filter-date-sep">-</span>
                  <input type="date" className="filter-date"
                    value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
                </div>
              </div>

              {hasFilter && (
                <button className="btn-clear-filter" onClick={clearCalFilter}>
                  <Icon name="xCircle" size={13}/> ล้าง filter ทั้งหมด
                </button>
              )}
            </div>
          )}

    {viewMode === "grid" && (
            <>
              <div className="cal-dow-row">
                {DAYS_SHORT.map((d,i)=>(
                  <div key={d} className={`cal-dow ${i===0?"dow-sun":i===6?"dow-sat":""}`}>{d}</div>
                ))}
              </div>
              <div className="cal-grid-a">
      {cells.map((d,i)=>{
        if(!d) return <div key={`x${i}`} className="cal-cell-a cal-empty" />;
        const ds=`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const evs=byDate[ds] || [];
        const isToday=ds===todayStr;
        const isSel=ds===normDate(selectedDate);
        const isDragOver = drag && drag.moved && hoverDate===ds && ds!==drag.ev.date;
        const isJustAdded = ds===normDate(justAddedDate);
        const excelEvs = evs.filter(e=>e.source==="excel");
        const manualEvs = evs.filter(e=>e.source!=="excel");
        // มีทั้งจากเอ็กเซลและพิมพ์เพิ่มเอง: โชว์ของเอ็กเซลฝั่งซ้าย + รวมของที่พิมพ์เพิ่มเป็น badge ฝั่งขวา
        // ถ้ามีแหล่งเดียว โชว์เป็นรายการปกติเหมือนเดิม (ไม่ต้องแยกฝั่ง)
        const hasSplit = excelEvs.length>0 && manualEvs.length>0;
        const leftEvs = hasSplit ? excelEvs : evs;
        const renderEvRow = (ev) => (
          <div key={ev.id}
            className={`cal-ev-item cal-ev-${(getEventTypeCls(ev) || getCategoryCls(ev)).replace("cat-","")} ${drag?.ev?.id===ev.id?"ev-dragging":""} ${updatingId===ev.id?"cal-ev-updating":""}`}
            style={{touchAction:"none"}}
            onPointerDown={e=>startDrag(e,ev)}
            onPointerMove={onDragMove}
            onPointerUp={e=>onDrag(e,ev)}
            onPointerCancel={e=>{e.stopPropagation();setDrag(null);setHoverDate(null);}}
            onClick={e=>e.stopPropagation()}>
            <span className="drag-handle"></span>
            <span className="cal-ev-time">{(ev.time_raw?.match(/\d{1,2}[.:]\d{2}/) || [ev.time_raw?.split("-")[0]?.trim()])[0]}</span>
            <span className="cal-ev-name">{ev.title?.substring(0,14)}</span>
            {updatingId===ev.id && <span className="cal-ev-spinner"/>}
          </div>
        );
        return (
          <div key={ds} data-cal-date={ds}
          className={`cal-cell-a ${isSel?"cal-cell-sel":""} ${isToday?"cal-cell-today":""} ${isDragOver?"cal-cell-dragover":""} ${isJustAdded?"cal-cell-just-added":""}`}
          onClick={()=>setSelectedDate(ds)}>
          <div className={`cal-d-a ${getDayCls(ds)} ${isToday?"cal-today-ring":""}`}>{d}</div>
          <div className={`cal-ev-list ${hasSplit?"cal-ev-list-split":""}`}>
            <div className="cal-ev-list-left">
              {leftEvs.slice(0,2).map(renderEvRow)}
              {leftEvs.length>2 && (
                <MoreEventsBadge events={leftEvs.slice(2)} count={leftEvs.length-2} onSelectEvent={onSelectEvent} pulse={isJustAdded}
                  open={openMoreDate===ds}
                  onToggle={()=>setOpenMoreDate(d=>d===ds?null:ds)}/>
              )}
            </div>
            {hasSplit && (
              <div className="cal-ev-manual-badge" onClick={e=>{e.stopPropagation(); onSelectEvent(manualEvs[0]);}}>
                +{manualEvs.length}
              </div>
            )}
          </div>
        </div>
      );
    })}
              </div>
            </>
    )}

       {viewMode === "agenda" && (
         <AgendaListView
           events={monthEvs}
           onSelectEvent={onSelectEvent}
           onEventDeleted ={onEventDeleted}
        />
       )}
       {viewMode === "grid" && selectedDate && (
        <>
        <div className="cal-day-panel-backdrop" onClick={()=>setSelectedDate("")}/>
        <div className="cal-day-panel">
          <div className="cal-day-label">
            <span className={`cal-day-dow ${getDayCls(selectedDate)}`}>{dayOfWeekTH(selectedDate)}</span>
            <span className="cal-day-fulldate">{formatDateTH(selectedDate)}</span>
            <span className="section-count">{selectedEvs.length} รายการ</span>
            <button className="cal-day-panel-close" onClick={()=>setSelectedDate("")} aria-label="ปิด"><Icon name="x" size={15}/></button>
          </div>
          <DayTimeline
          events={selectedEvs}
          onSelectEvent={onSelectEvent}
         />
       </div>
       </>
       )}

{drag && (
  <div className="drag-overlay">
    <div className="drag-ghost"><Icon name="calendar" size={15}/> {drag.ev.title?.substring(0,20) || "รายการ"}</div>
    {drag.moved
      ? (hoverDate
          ? <div className="drag-target-label">ปล่อยเพื่อย้ายไป {formatDateTH(hoverDate,true)}</div>
          : <div className="drag-target-label">ลากไปยังวันที่ต้องการ</div>)
      : <div className="drag-hint">ลากรายการเพื่อย้ายวัน</div>
    }
  </div>
)}

{showMonthPicker && (
  <div className="sheet-overlay" onClick={()=>{setShowMonthPicker(false);setShowYearGrid(false);}}>
    <div className="sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-handle"/>
      <div className="sheet-title">เลือกเดือน/ปี</div>

      <div className="month-picker-year-row">
        <button
          className="cal-nav-btn"
          onClick={()=>showYearGrid ? setYearGridStart(s=>s-12) : setYear(y=>y-1)}>‹</button>
        <button
          className="month-picker-year month-picker-year-btn"
          onClick={()=>{
            setYearGridStart(year - 5);
            setShowYearGrid(g=>!g);
          }}>
          {showYearGrid ? `${yearGridStart+543} - ${yearGridStart+11+543}` : `${year+543}`}
        </button>
        <button
          className="cal-nav-btn"
          onClick={()=>showYearGrid ? setYearGridStart(s=>s+12) : setYear(y=>y+1)}>›</button>
      </div>

      {showYearGrid ? (
        <div className="month-picker-grid">
          {Array.from({length:12},(_,i)=>yearGridStart+i).map(y=>{
            const isSelected = y === year;
            return (
              <button key={y}
                className={`month-picker-item${isSelected?" selected":""}`}
                onClick={()=>{
                  setYear(y);
                  setShowYearGrid(false);
                }}>
                {y+543}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="month-picker-grid">
          {MONTHS_TH.slice(1).map((m, i) => {
            const mIdx = i + 1;
            const isSelected = mIdx === month;
            return (
              <button key={mIdx}
                className={`month-picker-item${isSelected?" selected":""}`}
                onClick={()=>{
                  setMonth(mIdx);
                  setSelectedDate("");
                  setShowMonthPicker(false);
                }}>
                {m}
              </button>
            );
          })}
        </div>
      )}

      <button className="btn-sheet-close" onClick={()=>{setShowMonthPicker(false);setShowYearGrid(false);}}>ปิด</button>
    </div>
  </div>
)}
  </div>
);
}

