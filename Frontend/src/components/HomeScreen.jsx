import { useEffect, useState } from "react";
import Icon from "../Icon";
import { API } from "../api/events";
import { MONTHS_TH, toDateStr, formatDateTH, dayOfWeekTH } from "../utils/date";
import { showToast } from "../utils/toast";
import EventCard from "./EventCard";
import PrintSheet from "./PrintSheet";

// ---------------------------------------------------------------------------
// หน้าแรก
// ---------------------------------------------------------------------------
export default function HomeScreen({ events, uploadStats, onSelectEvent, onUpload }) {
  function handleExportExcel() {
    window.open(`${API}/events/export-excel`, "_blank");
    showToast("กำลังดาวน์โหลดไฟล์ Excel");
  }

  const today    = new Date();
  const todayStr = toDateStr(today);
  const tmrStr   = toDateStr(new Date(today.getTime()+86400000));
  const ydayStr  = toDateStr(new Date(today.getTime()-86400000));
  const todayEvs = events.filter(e=>e.date===todayStr);
  const tmrEvs   = events.filter(e=>e.date===tmrStr);
  const ydayEvs  = events.filter(e=>e.date===ydayStr);

  const thisMonth = today.getMonth()+1;
  const thisYear  = today.getFullYear();

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate()-(today.getDay()===0?6:today.getDay()-1));
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr   = toDateStr(weekEnd);

  const monthEvs = events.filter(e=>{
    const [y,m]=(e.date||"").split("-");
    return parseInt(y)===thisYear && parseInt(m)===thisMonth;
  });
  const weekEvs = events.filter(e=>e.date>=weekStartStr && e.date<=weekEndStr);
  const changed = monthEvs.filter(e=>e.status?.includes("ยกเลิก")||e.status?.includes("ย้าย")).length;

// การประชุมครั้งถัดไปที่ยังมาไม่ถึง + นับถอยหลัง
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  
  const nextMeeting = (() => {
    const now = new Date(nowTick);
    const parsed = events
      .filter(e => e.date && !(e.status?.includes("ยกเลิก")))
      .map(e => {
        const m = (e.time_raw || "").match(/(\d{1,2})[.:](\d{2})/);
        const hh = m ? parseInt(m[1]) : 0;
        const mm = m ? parseInt(m[2]) : 0;
        const [y, mo, d] = e.date.split("-").map(Number);
        return { ...e, _start: new Date(y, mo - 1, d, hh, mm) };
      })
      .filter(e => !isNaN(e._start) && e._start >= now)
      .sort((a, b) => a._start - b._start);
    return parsed[0] || null;  
  })();

  function countdownText(start, now = new Date()) {
    const diffMin = Math.round((start - now) / 60000);
    if (diffMin < 60) return `อีก ${diffMin} นาที`;
    const sD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const tD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.round((sD - tD) / 86400000);
    if (dayDiff === 0) return `อีก ${Math.round((start - now) / 3600000)}ชั่วโมง`;
    if (dayDiff === 1) return `พรุ่งนี้`;
    if (dayDiff <= 7) return `อีก ${dayDiff} วัน`;
    return formatDateTH(toDateStr(start), true);
  }


  const [showPrint, setShowPrint] = useState(false);
  const [logoErr,   setLogoErr]   = useState(false);

  return (
    <div className="screen">
      <div className="home-hero">
        <div className="home-hero-top">
          {logoErr ? (
            <div className="home-logo home-logo-fallback">อส.</div>
          ) : (
            <img src="/logo.png.jpg" className="home-logo" alt="logo"
              onError={()=>setLogoErr(true)}/>
          )}
          <div className="home-hero-org-block">
            <div className="home-hero-org">กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช</div>
            <div className="home-hero-center-name">ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร</div>
          </div>
        </div>
        <div className="home-hero-divider"/>
        <div className="home-hero-title">ตารางการประชุมทางไกลผ่านจอภาพ</div>
        <div className="home-hero-sub">Video Conference · ปีงบประมาณ พ.ศ. 2569</div>
        <div className="home-hero-actions">
          <button className="btn-update" onClick={onUpload}><Icon name="upload" size={15}/> อัปเดตข้อมูลตาราง</button>
          <button className="btn-print" onClick={()=>setShowPrint(true)}><Icon name="printer" size={15}/> ปริ้นตาราง</button>
          <button className="btn-print" onClick={handleExportExcel}>
            <Icon name="fileText" size={15}/> Export Excel (ทั้งหมด)
          </button>
        </div>
      </div>

      <div className={`next-meeting${nextMeeting ? "" : " is-empty"}`}>
        <div className="next-meeting-content">
          <div className="next-meeting-label">
            <span className="next-meeting-label-icon"><Icon name="clock" size={18}/></span>
            การประชุมครั้งถัดไป
          </div>
          {nextMeeting ? (
            <>
              <div className="next-meeting-countdown">{countdownText(nextMeeting._start, new Date(nowTick))}</div>
              <div className="next-meeting-info">
                <div className="next-meeting-info-row">
                  <Icon name="calendar" size={15}/>
                  <span>{dayOfWeekTH(nextMeeting.date)} {formatDateTH(nextMeeting.date)}</span>
                </div>
                <div className="next-meeting-info-row">
                  <Icon name="clock" size={15}/>
                  <span>{nextMeeting.time_raw || "-"}</span>
                </div>
                {nextMeeting.department && (
                  <div className="next-meeting-info-row">
                    <Icon name="users" size={15}/>
                    <span>{nextMeeting.department}</span>
                  </div>
                )}
              </div>
              <div className="next-meeting-title">{nextMeeting.title || "-"}</div>
              <button className="next-meeting-btn" onClick={()=>onSelectEvent(nextMeeting)}>
                ดูรายละเอียด ›
              </button>
            </>
          ) : (
            <div className="next-meeting-title">ยังไม่มีการประชุมที่กำหนดไว้</div>
          )}
        </div>
      </div>

    {events.length > 0 && (
      <div className="total-badge">ข้อมูลในระบบทั้งหมด {events.length} รายการ</div>
    )}

      <div className="section-title">สรุปข้อมูลเดือนนี้ — {MONTHS_TH[thisMonth]}</div>
      <div className="stats-grid">
        {[
          {icon:"clipboard",     n:monthEvs.length, l:"รายการเดือนนี้",   cls:"c-month", badge:`${monthEvs.length} รายการ`},
          {icon:"calendar",      n:todayEvs.length, l:"วันนี้",            cls:"c-today", badge:`${todayEvs.length} รายการ`},
          {icon:"calendar",      n:weekEvs.length,  l:"สัปดาห์นี้",        cls:"c-week",  badge:`${weekEvs.length} รายการ`},
          {icon:"alertTriangle", n:changed,          l:"มีการเปลี่ยนแปลง", cls:"c-moved", badge: changed===0 ? "ปกติ" : `${changed} รายการ`},
        ].map(s=>(
          <div className={`stat-box ${s.cls}`} key={s.l}>
            <div className="stat-emoji"><Icon name={s.icon} size={22}/></div>
            <div className="stat-info">
              <div className="stat-n">{s.n}</div>
              <div className="stat-l">{s.l}</div>
              <div className="stat-badge">{s.badge}</div>
            </div>
          </div>
        ))}
      </div>

      {uploadStats && (
        <div className="upload-history-card">
          <div className="upload-history-header">
            <Icon name="upload" size={13}/>
            <span>ประวัติการอัปเดตข้อมูล</span>
          </div>
          <div className="upload-history-body">
            <div className="upload-history-col">
              <div className="upload-history-icon-row"><Icon name="fileText" size={15}/> Excel</div>
              <div className="upload-history-num">{uploadStats.excel}</div>
              <div className="upload-history-unit">ครั้ง</div>
            </div>
            <div className="upload-history-vline"/>
            <div className="upload-history-col">
              <div className="upload-history-icon-row"><Icon name="image" size={15}/> รูปภาพ</div>
              <div className="upload-history-num">{uploadStats.image}</div>
              <div className="upload-history-unit">ครั้ง</div>
            </div>
          </div>
          {uploadStats.last_uploaded_at && (
            <div className="upload-history-footer">
              <Icon name="clock" size={12}/>
              อัปเดตล่าสุด · {new Date(uploadStats.last_uploaded_at).toLocaleString("th-TH",{dateStyle:"medium",timeStyle:"short"})}
            </div>
          )}
        </div>
      )}

      <div className="section-title">วันนี้
        <span className="section-date">{dayOfWeekTH(todayStr)} {formatDateTH(todayStr)}</span>
        <span className="section-count">{todayEvs.length} รายการ</span>
      </div>
      {todayEvs.length===0
        ? <div className="empty-day">ไม่มีการประชุมวันนี้</div>
        : todayEvs.map(ev=><EventCard key={ev.id} ev={ev} onSelect={onSelectEvent}/>)
      }

      <div className="section-title">พรุ่งนี้
        <span className="section-date">{formatDateTH(tmrStr)}</span>
        <span className="section-count">{tmrEvs.length} รายการ</span>
      </div>
            {tmrEvs.length===0
        ? <div className="empty-day"><Icon name="calendar" size={20}/> ไม่มีการประชุมพรุ่งนี้</div>
        : tmrEvs.map(ev=><EventCard key={ev.id} ev={ev} onSelect={onSelectEvent}/>)
      }

      {ydayEvs.length > 0 && (
        <>
          <div className="section-title section-title-muted">เมื่อวาน
            <span className="section-date">{formatDateTH(ydayStr)}</span>
            <span className="section-count">{ydayEvs.length} รายการ</span>
          </div>
          {ydayEvs.map(ev=><EventCard key={ev.id} ev={ev} onSelect={onSelectEvent}/>)}
        </>
      )}
      <div style={{height:24}}/>
      {showPrint && <PrintSheet events={events} onClose={()=>setShowPrint(false)} />}
    </div>
  );
}
