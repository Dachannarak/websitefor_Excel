import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";
import { deleteEventById } from "../api/events";
import { getDayCls, dayOfWeekTH, formatDateTH } from "../utils/date";
import { getStatusCls, getStatusLabel, getAppCls, getAppLabel } from "../utils/eventStyle";
import { showToast } from "../utils/toast";
import ConfirmSheet from "./ConfirmSheet";

// ---------------------------------------------------------------------------
// หน้ารายละเอียด
// ---------------------------------------------------------------------------
export default function DetailScreen({ event, events = [], onNavigate, onBack, onEdit, onDeleted }) {
  const [deleting,    setDeleting]    = useState(false);
  const [delErr,      setDelErr]      = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });
  useEffect(() => {
    if (!window.history.state?.detail) window.history.pushState({ detail: true }, "");
    const handlePop = () => onBackRef.current();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  if (!event) return null;
  const st = getStatusCls(event.status);
  const dayCls = getDayCls(event.date);

  const sorted = [...events].sort((a,b)=>
    a.date===b.date ? (a.time_raw||"").localeCompare(b.time_raw||"") : a.date.localeCompare(b.date)
  );
  const curIdx = sorted.findIndex(e=>e.id===event.id);
  const prevEv = curIdx > 0 ? sorted[curIdx-1] : null;
  const nextEv = curIdx >= 0 && curIdx < sorted.length-1 ? sorted[curIdx+1] : null;

  async function handleDelete() {
    setDeleting(true); setDelErr(null);
    try {
      await deleteEventById(event.id);
      onDeleted();
      if (window.history.state?.detail) window.history.back();
    } catch(e) { setDelErr(e.message); setConfirmOpen(false); }
    finally { setDeleting(false); }
  }

  return (
    <div className="screen detail-screen">
      <div className={`detail-head detail-day-${dayCls}`}>
        <div className="detail-nav-row">
          <button className="btn-back" onClick={() => window.history.back()}><Icon name="arrowLeft" size={15}/> กลับ</button>
          <div className="detail-nav-arrows">
            <button
              className="detail-nav-btn"
              disabled={!prevEv}
              onClick={()=>prevEv && onNavigate(prevEv)}
              aria-label="งานก่อนหน้า">
              ‹
            </button>
            <span className="detail-nav-count">{curIdx+1} / {sorted.length}</span>
            <button
              className="detail-nav-btn"
              disabled={!nextEv}
              onClick={()=>nextEv && onNavigate(nextEv)}
              aria-label="งานถัดไป">
              ›
            </button>
          </div>
        </div>
        <div className="detail-meta">
          <span className={`detail-dow ${dayCls}`}>{dayOfWeekTH(event.date)}</span>
          <span className="detail-date-txt">{formatDateTH(event.date)}</span>
        </div>
        <div className="detail-title">{event.title}</div>
        <div className="detail-badges">
          <span className={`ev-badge ${getAppCls(event.app)}`}>
            {getAppLabel(event.app)}
          </span>
          <span className={`status-badge ${st}`}>{getStatusLabel(event.status)}</span>
        </div>
      </div>
      <div className="detail-body">
        {event.image_url && (
          <img src={event.image_url} alt="รูปประกอบ"
            style={{width:"100%", maxWidth:400, borderRadius:10, marginBottom:12}}/>
        )}
        {[
          {icon:"clock",         label:"เวลา",          val:event.time_raw},
          {icon:"mapPin",        label:"สถานที่",        val:event.location},
          {icon:"briefcase",     label:"หน่วยงาน",      val:event.department},
          {icon:"link",          label:"ลิงก์ประชุม",    val:event.meeting_link},
          {icon:"fileText",      label:"เลขที่หนังสือ", val:event.book_no},
          {icon:"messageCircle", label:"รายละเอียด",    val:event.details},
        ].filter(r=>r.val).map(r=>(
          <div className="detail-row" key={r.label}>
            <span className="detail-icon"><Icon name={r.icon} size={17}/></span>
            <div className="detail-row-content">
              <div className="detail-label">{r.label}</div>
              <div className="detail-val">{r.val}</div>
            </div>
            {r.label==="ลิงก์ประชุม" && (
              <button className="btn-copy-link" onClick={()=>{
                navigator.clipboard.writeText(r.val)
                  .then(()=>showToast("คัดลอกลิงก์แล้ว ✓"))
                  .catch(()=>showToast("คัดลอกลิงก์ไม่สำเร็จ", "error"));
              }}>
                คัดลอก
              </button>
            )}
          </div>
        ))}
        {(event.coordinator || event.assignee) && (
          <div className="detail-row detail-row-pair">
            <span className="detail-icon"><Icon name="users" size={17}/></span>
            <div className="detail-pair-grid">
              {event.coordinator && (
                <div>
                  <div className="detail-label">ผู้ประสานงาน</div>
                  <div className="detail-val">{event.coordinator}</div>
                </div>
              )}
              {event.assignee && (
                <div>
                  <div className="detail-label">ผู้รับผิดชอบ</div>
                  <div className="detail-val">{event.assignee}</div>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="detail-edit-bar">
          <button className="btn-edit" onClick={onEdit}><Icon name="edit" size={15}/> แก้ไขรายการนี้</button>
          <button className="btn-delete" onClick={()=>setConfirmOpen(true)} disabled={deleting}>
            {deleting ? "กำลังลบ..." : <><Icon name="trash" size={16}/> ลบรายการนี้</>}
          </button>
          {delErr && <div className="form-err"><Icon name="xCircle" size={16}/> {delErr}</div>}
        </div>
      </div>
      {confirmOpen && (
        <ConfirmSheet
          title="ยืนยันการลบรายการนี้?"
          message={event.title ? `"${event.title}" — กู้คืนได้ภายหลังจากถังขยะ` : undefined}
          confirmLabel="ลบรายการ"
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={()=>setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
