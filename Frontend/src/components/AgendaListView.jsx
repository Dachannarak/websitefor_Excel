import { useState } from "react";
import Icon from "../Icon";
import { deleteEventById } from "../api/events";
import { getDayCls, dayOfWeekTH, formatDateTH } from "../utils/date";
import { getAppCls, getAppLabel, getEventTypeCls, getCategoryCls, getAppIconName } from "../utils/eventStyle";
import { showToast } from "../utils/toast";
import ConfirmSheet from "./ConfirmSheet";

export default function AgendaListView({ events, onSelectEvent, onEventDeleted }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [confirmEv,  setConfirmEv]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  // จัดกลุ่มตามวันที่ เรียงจากเก่าไปใหม่
  const grouped = {};
  events.forEach(ev => {
    if (!ev.date) return;
    grouped[ev.date] = grouped[ev.date] || [];
    grouped[ev.date].push(ev);
  });
  const sortedDates = Object.keys(grouped).sort();

  function askDelete(ev) {
    setOpenMenuId(null);
    setConfirmEv(ev);
  }

  async function handleDelete() {
    if (!confirmEv) return;
    setDeleting(true);
    try {
      await deleteEventById(confirmEv.id);
      showToast("ลบรายการแล้ว", "error");
      onEventDeleted?.();
    } catch(e) {
      showToast(e.message || "ลบไม่สำเร็จ", "error");
    } finally {
      setDeleting(false);
      setConfirmEv(null);
    }
  }

if (sortedDates.length === 0) {
  return <div className="empty-day" style={{margin:"16px"}}>ไม่มีรายการในเดือนนี้</div>;
}

return (
  <div className="agenda-list">
    {sortedDates.map(date => (
      <div className="agenda-day-group" key={date}>
        <div className={`agenda-day-header ${getDayCls(date)}`}>
          <span className="agenda-day-dow">{dayOfWeekTH(date)}</span>
          <span className="agenda-day-date">{formatDateTH(date)}</span>
          <span className="agenda-day-count">{grouped[date].length} รายการ</span>
  </div>

  {grouped[date]
    .sort((a,b)=>(a.time_raw||"").localeCompare(b.time_raw||""))
    .map(ev => (
    <div className="ev-row-menu-wrap" key={ev.id}>
      <div
        className={`ev-row-panel ${getEventTypeCls(ev) || getCategoryCls(ev)}`}
        onClick={()=>onSelectEvent(ev)}>
        <div className="ev-row-panel-bar"/>
        <div className="ev-row-icon">
          <Icon name={getAppIconName(ev.app)} size={18}/>
        </div>
        <div className="ev-row-panel-body">
          <div className="ev-row-panel-title">{ev.title}</div>
          <div className="ev-row-panel-time"><Icon name="clock" size={10}/> {ev.time_raw||"-"}</div>
          {ev.department && <div className="ev-row-panel-dept">{ev.department}</div>}
        </div>
        <span className={`ev-badge ${getAppCls(ev.app)}`}>
          {getAppLabel(ev.app)}
        </span>
        <button className="ev-row-menu-btn" onClick={e=>{
          e.stopPropagation();
          setOpenMenuId(id => id===ev.id ? null : ev.id);
        }}>
          <Icon name="moreVertical" size={16}/>
        </button>
        </div>

        {openMenuId === ev.id && (
          <>
            <div className="ev-row-menu-backdrop" onClick={()=>setOpenMenuId(null)}/>
            <div className="ev-row-menu-popup">
              <button className="ev-row-menu-item" onClick={()=>{ setOpenMenuId(null); onSelectEvent(ev); }}>
                <Icon name="edit" size={15}/> แก้ไข
              </button>
              <button className="ev-row-menu-item ev-row-menu-del" onClick={()=>askDelete(ev)}>
                <Icon name="trash" size={15}/> ลบ
              </button>
            </div>
          </>
        )}
      </div>
      ))}
      </div>
    ))}

    {confirmEv && (
      <ConfirmSheet
        title="ยืนยันการลบรายการ"
        message={confirmEv.title ? `ต้องการลบ "${confirmEv.title}" ใช่หรือไม่?` : "ต้องการลบรายการนี้ใช่หรือไม่?"}
        confirmLabel="ลบรายการ"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={()=>setConfirmEv(null)}
      />
    )}
  </div>
);
}
