import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import { API, ADMIN_HEADERS } from "./api/events";
import { formatDateTH } from "./utils/date";
import { showToast } from "./utils/toast";
import ToastHost from "./components/ToastHost";
import EventForm from "./components/EventForm";
import HomeScreen from "./components/HomeScreen";
import CalendarScreen from "./components/CalendarScreen";
import SearchScreen from "./components/SearchScreen";
import DetailScreen from "./components/DetailScreen";
import ReportScreen from "./components/ReportScreen";
import UploadSheet from "./components/UploadSheet";
import FABSpeedDial from "./components/FABSpeedDial";
import TabBar from "./components/TabBar";
import ErrorBoundary from "./components/ErrorBoundary";
import { usePullToRefresh } from "./hooks/usePullToRefresh";

// ---------------------------------------------------------------------------
// App Root
// ---------------------------------------------------------------------------
function AppRoot() {
  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(false);
  const [tab,          setTab]          = useState("home");
  const [detail,       setDetail]       = useState(null);
  const [editEvent,    setEditEvent]    = useState(null);
  const [showUpload,   setShowUpload]   = useState(false);
  const [uploadStats,  setUploadStats]  = useState(null);
  const [darkMode,     setDarkMode]     = useState(false);
  const [calFocusDate, setCalFocusDate] = useState(null);
  const [calViewMode,  setCalViewMode]  = useState("agenda"); // "agenda" | "grid" — เก็บไว้ที่นี่ ไม่ให้รีเซ็ตตอนกดกลับจากหน้ารายละเอียด

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme", darkMode ? "dark" : "light"
    );
  }, [darkMode]);

  const toastHost = <ToastHost />;

  const eventsReqId = useRef(0);
  const fetchEvents = useCallback(()=>{
    const reqId = ++eventsReqId.current;
    return fetch(`${API}/events/`)
      .then(r=>{ if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d=>{ if (reqId !== eventsReqId.current) return; setEvents(Array.isArray(d) ? d : []); setLoadError(false); setLoading(false); })
      .catch(()=>{ if (reqId !== eventsReqId.current) return; setLoadError(true); setLoading(false); });
  },[]);

  const statsReqId = useRef(0);
  const fetchStats = useCallback(()=>{
    const reqId = ++statsReqId.current;
    return fetch(`${API}/api/v1/upload-stats`)
      .then(r=>r.ok ? r.json() : null)
      .then(d=>{ if (reqId !== statsReqId.current) return; if(d) setUploadStats(d); })
      .catch(()=>{});
  },[]);

  useEffect(()=>{ fetchEvents(); fetchStats(); },[fetchEvents, fetchStats]);

  const ptr = usePullToRefresh(async () => {
    await Promise.all([fetchEvents(), fetchStats()]);
    showToast("อัปเดตข้อมูลแล้ว")
  });
  if (loading) return (
    <>
      <div className="app-loading">
        <div className="spinner"/>
        <div>กำลังโหลดข้อมูล...</div>
      </div>
      {toastHost}
    </>
  );

  if (loadError && events.length === 0) return (
    <>
      <div className="app-loading">
        <div>โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ</div>
        <button onClick={fetchEvents}>ลองใหม่</button>
      </div>
      {toastHost}
    </>
  );

  // แสดง form เพิ่ม/แก้ไข
  if (editEvent !== null) return (
    <div className="app">
      <EventForm
        event={editEvent === "new" ? null : editEvent}
        onBack={()=>{ setEditEvent(null); }}
        onSaved={(saved)=>{
          const wasNew = editEvent === "new";
          fetchEvents();
          setEditEvent(null);
          if (wasNew) {
            window.history.replaceState({}, "");
            setCalFocusDate(saved.date);
            setTab("calendar");
          } else {
            window.history.replaceState({ detail: true }, "");
            setDetail(saved);
          }
        }}
      />
      {toastHost}
    </div>
  );

  // แสดง detail
  if (detail) return (
    <div className="app">
      <DetailScreen
        event={detail}
        events={events}
        onNavigate={setDetail}
        onBack={()=>setDetail(null)}
        onEdit={()=>setEditEvent(detail)}
        onDeleted={()=>{ fetchEvents(); setDetail(null); showToast("ลบรายการแล้ว", "error"); }}
      />
      {toastHost}
    </div>
  );

  return (
    <div className="app">
      <div className="app-body" {...ptr.handlers}>
       <div className="ptr-indicator" style={{height: ptr.pulling, transition: ptr.pulling===0 ? "height .2s ease" : "none"}}>
        <div className={`ptr-spinner${ptr.refreshing?" ptr-spinning":""}`}
                     style={{opacity: Math.min(ptr.pulling/60, 1)}}>
                     {ptr.refreshing
                      ? <span className="spinner-sm"/>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          style={{transform: `rotate(${Math.min(ptr.pulling/60, 1)*360}deg)`, transition:"none"}}>
                          <polyline points="20 6 9 17 4 12"/>
                          </svg>
                     }
        </div>
       </div>
              {tab==="home" && <HomeScreen events={events} uploadStats={uploadStats} onSelectEvent={setDetail} onUpload={()=>setShowUpload(true)}/>}
        {tab==="calendar" && (
          <CalendarScreen
            events={events}
            focusDate={calFocusDate}
            onFocusDateApplied={()=>setCalFocusDate(null)}
            viewMode={calViewMode}
            onViewModeChange={setCalViewMode}
            onSelectEvent={setDetail}
            onEventDeleted={fetchEvents}
            onEventDateChange={async (ev, newDate) => {
              const res = await fetch(`${API}/events/${ev.id}`, {
                method: "PUT",
                headers: {"Content-Type": "application/json", ...ADMIN_HEADERS},
                body: JSON.stringify({...ev, date: newDate}),
              });
              const text = await res.text();
              const data = text ? JSON.parse(text) : {};
              if (!res.ok) throw new Error(data.detail || "อัปเดตวันที่ไม่สำเร็จ");
              await fetchEvents();
              showToast(`ย้ายไป ${formatDateTH(newDate,true)} แล้ว`);
            }}
          />
        )}
        {tab==="search" && <SearchScreen events={events} onSelectEvent={setDetail}/>}
        {tab==="report" && <ReportScreen events={events} darkMode={darkMode} onDataChanged={fetchEvents}/>}
      </div>

      {/* Theme toggle */}
      <FABSpeedDial darkMode={darkMode} onToggleTheme={() =>setDarkMode(d=>!d)}/>

      <TabBar tab={tab} setTab={setTab} onNew={()=>setEditEvent("new")}/>
      {showUpload && <UploadSheet onClose={()=>setShowUpload(false)} onImported={async ()=>{ await Promise.all([fetchEvents(), fetchStats()]); }}/>}
      {toastHost}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  );
}
