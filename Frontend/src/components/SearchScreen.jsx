import { useState } from "react";
import Icon from "../Icon";
import { formatDateTH } from "../utils/date";
import { getAppCls, getAppLabel, getEventTypeCls, getCategoryCls, getAppIconName } from "../utils/eventStyle";

// ---------------------------------------------------------------------------
// หน้าค้นหา
// ---------------------------------------------------------------------------
const APP_OPTIONS = [
  {val:"app-zoom",  label:"Zoom"},
  {val:"app-teams", label:"Teams"},
  {val:"app-meet",  label:"Google Meet"},
  {val:"app-webex", label:"Cisco Webex"},
  {val:"app-line",  label:"LINE"},
  {val:"app-other", label:"อื่นๆ"},
];

export default function SearchScreen({ events, onSelectEvent }) {
  const [q,          setQ]          = useState("");
  const [filterApp,  setFilterApp]  = useState([]);
  const [filterSt,   setFilterSt]   = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [showFilter, setShowFilter] = useState(false);

  // รวบ dept จากข้อมูลจริง
  const deptList = [...new Set(events.map(e=>e.department).filter(Boolean))].sort();

  const hasFilter   = filterApp.length>0 || filterSt || filterDept || dateFrom || dateTo;
  const showResults = q.length >= 2 || hasFilter;

  function toggleFilterApp(val) {
    setFilterApp(arr => arr.includes(val) ? arr.filter(v=>v!==val) : [...arr, val]);
  }
  function clearAll() {
    setFilterApp([]); setFilterSt(""); setFilterDept("");
    setDateFrom(""); setDateTo("");
  }

  const results = events.filter(e => {
    if (q.length >= 2) {
      const s = q.toLowerCase();
      const match = e.title?.toLowerCase().includes(s) ||
                    e.department?.toLowerCase().includes(s) ||
                    e.location?.toLowerCase().includes(s) ||
                    e.assignee?.toLowerCase().includes(s);
      if (!match) return false;
    }
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

  return (
    <div className="screen">
      {/* Search Bar */}
      <div className="search-bar-wrap">
        <div className="search-row">
          <div className="search-input-wrap">
            <span className="search-icon"><Icon name="search" size={16}/></span>
            <input className="search-input"
              placeholder="ค้นหาชื่อประชุม หน่วยงาน สถานที่..."
              value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
          </div>
          <button
            className={`btn-filter-toggle${showFilter ? " active" : ""}${hasFilter ? " has-filter" : ""}`}
            onClick={()=>setShowFilter(f=>!f)}
            title="ตัวกรอง"
            aria-label="ตัวกรอง"
            aria-expanded={showFilter}>
            <Icon name="filter" size={16}/>
            {hasFilter && <span className="filter-dot"/>}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilter && (
        <div className="filter-panel">
          {/* App */}
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

          {/* สถานะ */}
          <div className="filter-row">
            <div className="filter-label">สถานะ</div>
            <div className="filter-chips">
              {[
                {val:"",          label:"ทั้งหมด"},
                {val:"done",      label:"พร้อมแล้ว"},
                {val:"wait",      label:"รอดำเนินการ"},
                {val:"cancel",    label:"ยกเลิก"},
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

          {/* หน่วยงาน */}
          <div className="filter-row">
            <div className="filter-label">หน่วยงาน</div>
            <select className="filter-select"
              value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
              <option value="">ทั้งหมด</option>
              {deptList.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* ช่วงวันที่ */}
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
            <button className="btn-clear-filter" onClick={clearAll}>
              <Icon name="xCircle" size={13}/> ล้าง filter ทั้งหมด
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {!showResults
        ? <div className="search-empty"><Icon name="search" size={30}/> พิมคำค้นหาหรือเลือกตัวกรอง</div>
        : results.length===0
          ? <div className="search-empty"><Icon name="xCircle" size={30}/> ไม่พบรายการที่ค้นหา</div>
          : <>
              <div className="search-result-count">{results.length} รายการ</div>
              {results.map(ev=>(
                <div className={`ev-row-panel ${getEventTypeCls(ev) || getCategoryCls(ev)}`} key={ev.id} onClick={()=>onSelectEvent(ev)}>
                  <div className="ev-row-panel-bar"/>
                  <div className="ev-row-icon">
                    <Icon name={getAppIconName(ev.app)} size={18}/>
                  </div>
                  <div className="ev-row-panel-body">
                    <div className="ev-row-panel-title">{ev.title}</div>
                    <div className="ev-row-panel-time">
                      <Icon name="clock" size={10}/> {formatDateTH(ev.date,true)} · {ev.time_raw?.split("-")[0]?.trim()||"-"}
                    </div>
                  </div>
                  <span className={`ev-badge ${getAppCls(ev.app)}`}>
                    {getAppLabel(ev.app)}
                  </span>
                </div>
              ))}
            </>
      }
    </div>
  );
}
