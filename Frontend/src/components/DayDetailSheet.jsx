import { Fragment, useEffect, useState } from "react";
import Icon from "../Icon";
import { dayOfWeekTH, formatDateTH } from "../utils/date";
import { getStatusCls, getStatusLabel, getEventTypeCls, getCategoryCls, getAppLabel, getAppIconName } from "../utils/eventStyle";
import ConfirmSheet from "./ConfirmSheet";

// ---------------------------------------------------------------------------
// DayDetailSheet — bottom sheet แสดงรายการประชุมทั้งหมดของวันที่เลือก พร้อมปุ่มดู/แก้ไข/ลบต่อรายการ
// ---------------------------------------------------------------------------
export function DayDetailSheet({ date, events, onClose, onEventClick, onEventEdit, onEventDelete }) {
  const [confirmEv, setConfirmEv] = useState(null);
  const doneCount = events.filter(ev => getStatusCls(ev.status) === "s-done").length;

  // ซ่อน TabBar ตอนเปิด sheet นี้ — บนมือถือบางรุ่น TabBar (fixed, z-index ต่ำกว่า) ยังโผล่ทับขอบล่างของ sheet ทั้งที่ควรถูกบัง ทำให้เลื่อนดูรายการสุดท้ายไม่ได้
  useEffect(() => {
    document.body.classList.add("day-detail-sheet-open");
    return () => document.body.classList.remove("day-detail-sheet-open");
  }, []);

  function handleConfirmDelete() {
    onEventDelete(confirmEv);
    setConfirmEv(null);
  }

  return (
    <Fragment>
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet day-detail-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="day-detail-header">
          <div>
            <div className="day-detail-dow">{dayOfWeekTH(date)}</div>
            <div className="day-detail-date">{formatDateTH(date)}</div>
            <div className="day-detail-count">
              {events.length} รายการ{doneCount > 0 && ` · ${doneCount} พร้อมแล้ว`}
            </div>
          </div>
          <button className="cal-day-panel-close-compact" onClick={onClose} aria-label="ปิด">
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="day-detail-list">
          {events.length === 0 && (
            <div className="empty-day"><Icon name="calendar" size={20}/> ไม่มีการประชุม</div>
          )}
          {events.map(ev => (
            <div key={ev.id}
              className={`event-list-item ${getEventTypeCls(ev) || getCategoryCls(ev)}`}
              onClick={() => onEventClick(ev)}>
              <div className="event-list-item__body">
                <div className="event-list-item__main">
                  <span className="event-list-item__time">{ev.time_raw}</span>
                  <span className="event-list-item__title">{ev.title}</span>
                  <span className={`event-list-item__status ${getStatusCls(ev.status)}`}>{getStatusLabel(ev.status)}</span>
                </div>
                <div className="event-list-item__meta">
                  {ev.app && (
                    <span className="event-list-item__meta-item">
                      <Icon name={getAppIconName(ev.app)} size={12}/> {getAppLabel(ev.app)}
                    </span>
                  )}
                  {ev.department && (
                    <span className="event-list-item__meta-item">
                      <Icon name="briefcase" size={12}/> {ev.department}
                    </span>
                  )}
                </div>
              </div>
              <div className="event-list-item__actions">
                <button className="event-list-item__action-btn" title="แก้ไข" aria-label="แก้ไข"
                  onClick={e => { e.stopPropagation(); onEventEdit(ev); }}>
                  <Icon name="edit" size={14} />
                </button>
                <button className="event-list-item__action-btn event-list-item__action-btn--danger" title="ลบ" aria-label="ลบ"
                  onClick={e => { e.stopPropagation(); setConfirmEv(ev); }}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

      {confirmEv && (
        <ConfirmSheet
          title="ลบรายการนี้?"
          message={confirmEv.title}
          confirmLabel="ลบ"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmEv(null)}
        />
      )}
    </Fragment>
  );
}
