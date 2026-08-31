import { parseTimeRange } from "../utils/date";
import { getEventTypeCls, getCategoryCls } from "../utils/eventStyle";

// ---------------------------------------------------------------------------
// หน้าปฏิทิน
// ---------------------------------------------------------------------------
export function DayTimeline({ events, onSelectEvent }) {
  const HOUR_START = 7;
  const HOUR_END = 20;
  const HOUR_PX = 48;
  const totalHeight = (HOUR_END - HOUR_START) * HOUR_PX;

  if (events.length === 0) {
    return <div className="empty-day">ไม่มีการประชุม</div>;
  }

  return (
    <div className="day-timeline">
      <div className="day-timeline-body" style={{height: totalHeight}}>
        {/* เส้นชั่วโมง + label */}
        {Array.from({length: HOUR_END - HOUR_START}, (_, i) => (
          <div key={i} className="day-timeline-row" style={{top: i*HOUR_PX}}>
            <span className="day-timeline-hour">{String(HOUR_START+i).padStart(2,"0")}:00</span>
            <div className="day-timeline-line"/>
          </div>
        ))}

        {/* Events */}
        {events.map(ev => {
          const { start, end } = parseTimeRange(ev.time_raw);
          const clampStart = Math.min(Math.max(start, HOUR_START*60), HOUR_END*60);
          const clampEnd = Math.min(Math.max(end, clampStart + 30), HOUR_END*60);
          const top = (clampStart - HOUR_START*60) / 60 * HOUR_PX;
          const height = Math.max((clampEnd - clampStart) / 60 * HOUR_PX, 32);
          return (
            <div key={ev.id}
            className={`day-timeline-event ${getEventTypeCls(ev) || getCategoryCls(ev)}`}
            style={{top, height}}
            onClick={()=>onSelectEvent(ev)}>
            <div className="day-timeline-event-title">{ev.title}</div>
            <div className="day-timeline-event-meta">
              {ev.time_raw} {ev.department && `. ${ev.department}`}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function MoreEventsBadge({ events, count, onSelectEvent, pulse, open, onToggle }) {
  return (
    <div className="cal-ev-more-wrap">
      <div className={`cal-ev-more${pulse ? " cal-ev-more-pulse" : ""}`}
      onClick={(e)=>{ e.stopPropagation(); onToggle(); }}>
      +{count}
    </div>
    {open && (
      <>
        <div className="cal-ev-more-backdrop" onClick={(e)=>{e.stopPropagation(); onToggle();}}/>
        <div className="cal-ev-more-popup" onClick={e=>e.stopPropagation()}>
          <div className="cal-ev-more-title">อีก {count} รายการ</div>
          {events.map(ev=>(
            <div key={ev.id} className="cal-ev-more-item"
              onClick={()=>{ onToggle(); onSelectEvent(ev); }}>
              <span className="cal-ev-more-time">{ev.time_raw?.split("-")[0]?.trim()}</span>
              <span className="cal-ev-more-name">{ev.title}</span>
            </div>
          ))}
        </div>
      </>
    )}
  </div>
 );
}
