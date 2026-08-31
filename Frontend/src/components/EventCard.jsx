import Icon from "../Icon";
import { getDayCls } from "../utils/date";
import { getAppCls, getAppLabel, getEventTypeCls, getCategoryCls } from "../utils/eventStyle";

// ---------------------------------------------------------------------------
// Event Card — หน้าแรก
// ---------------------------------------------------------------------------
export default function EventCard({ ev, onSelect }) {
  const dayCls = getDayCls(ev.date);
  return (
  <div className={`ev-card ${getEventTypeCls(ev) || getCategoryCls(ev)} ${dayCls}`} onClick={()=>onSelect(ev)}>
    <div className="ev-card-bar"/>
      <div className="ev-card-body">
        <div className="ev-card-time-row">
          <span className="ev-card-time"><Icon name="clock" size={11}/> {ev.time_raw||"-"}</span>
        {ev.department && <span className="ev-card-meta-dot">{ev.department}</span>}
        </div>
      </div>
      <span className={`ev-badge ${getAppCls(ev.app)}`}>
        {getAppLabel(ev.app)}
      </span>
    </div>
  );
}
