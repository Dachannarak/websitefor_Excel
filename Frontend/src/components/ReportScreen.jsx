import { useState } from "react";
import { PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import Icon from "../Icon";
import { API, ADMIN_HEADERS } from "../api/events";
import { MONTHS_TH, DAYS_SHORT, DAYS_FULL, toDateStr, formatDateTH, parseTimeRange } from "../utils/date";
import { showToast } from "../utils/toast";
import ConfirmSheet from "./ConfirmSheet";

// ตัวอักษรย่อ + สีแบรนด์ของแต่ละแอป (ไม่ใช้โลโก้จริง เลี่ยงปัญหาลิขสิทธิ์)
function appBrand(name = "") {
  const n = name.toLowerCase();
  if (n.includes("zoom"))  return { letter: "Z", color: "#2D8CFF" };
  if (n.includes("team"))  return { letter: "T", color: "#5059C9" };
  if (n.includes("webex")) return { letter: "W", color: "#00BCEB" };
  if (n.includes("meet"))  return { letter: "M", color: "#00897B" };
  if (n.includes("line"))  return { letter: "L", color: "#06C755" };
  return { letter: "•", color: "#9E9E9E" };
}

// ---------------------------------------------------------------------------
// หน้ารายงาน + Analytics (รวมเป็นหน้าเดียว)
// ---------------------------------------------------------------------------
export default function ReportScreen({ events, darkMode, onDataChanged }) {
  const today  = new Date();
  const [mode, setMode]       = useState("month");
  const [dupCheck, setDupCheck] = useState(null);
  const [checkingDup, setCheckingDup] = useState(false);
  const [selMonth, setSelMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`
  );

  function weekStart(d) {
    const dt = new Date(d+"T00:00:00");
    dt.setDate(dt.getDate()-(dt.getDay()===0?6:dt.getDay()-1));
    return toDateStr(dt);
  }
  function weekEnd(ws) {
    const d = new Date(ws+"T00:00:00");
    d.setDate(d.getDate()+6);
    return toDateStr(d);
  }

  const todayWs = weekStart(toDateStr(today));
  const [selWeek, setSelWeek] = useState(todayWs);

  const [showTrash,        setShowTrash]        = useState(false);
  const [trashList,        setTrashList]        = useState([]);
  const [loadingTrash,     setLoadingTrash]      = useState(false);
  const [restoringId,      setRestoringId]       = useState(null);
  const [showDeleteAll,    setShowDeleteAll]     = useState(false);
  const [deleteStep,       setDeleteStep]        = useState(1);
  const [deleteConfirmText,setDeleteConfirmText] = useState("");
  const [deletingAll,      setDeletingAll]       = useState(false);
  const [purgeId,          setPurgeId]           = useState(null);
  const [purging,          setPurging]           = useState(false);

  async function openTrash() {
    setShowTrash(true);
    setLoadingTrash(true);
    try {
      const res = await fetch(`${API}/events/trash/list`);
      const data = await res.json();
      setTrashList(Array.isArray(data) ? data : []);
    } catch {
      showToast("โหลดถังขยะไม่สำเร็จ", "error");
    } finally {
      setLoadingTrash(false);
    }
  }

  async function handleRestore(id) {
    setRestoringId(id);
    try {
      const res = await fetch(`${API}/events/${id}/restore`, { method:"POST" });
      if (!res.ok) throw new Error("กู้คืนไม่สำเร็จ");
      setTrashList(list => list.filter(ev => ev.id !== id));
      showToast("กู้คืนรายการแล้ว");
      onDataChanged?.();
    } catch(e) {
      showToast(e.message || "กู้คืนไม่สำเร็จ", "error");
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePermanentDelete(id) {
    setPurging(true);
    try {
      const res = await fetch(`${API}/events/${id}/permanent`, { method:"DELETE", headers:ADMIN_HEADERS });
      if (!res.ok) throw new Error("ลบถาวรไม่สำเร็จ");
      setTrashList(list => list.filter(ev => ev.id !== id));
      showToast("ลบถาวรแล้ว", "error");
    } catch(e) {
      showToast(e.message || "ลบถาวรไม่สำเร็จ", "error");
    } finally {
      setPurging(false);
      setPurgeId(null);
    }
  }

  function openDeleteAll() {
    setDeleteStep(1);
    setDeleteConfirmText("");
    setShowDeleteAll(true);
  }

  async function confirmDeleteAllStep2() {
    if (deleteConfirmText !== "ลบทั้งหมด") return;
    setDeletingAll(true);
    try {
      const res = await fetch(`${API}/events/all/soft-delete-all?confirm=DELETE_ALL_CONFIRMED`, { method:"DELETE", headers:ADMIN_HEADERS });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.detail || "ลบข้อมูลทั้งหมดไม่สำเร็จ");
      showToast(data.message || "ลบข้อมูลทั้งหมดแล้ว", "error");
      setShowDeleteAll(false);
      onDataChanged?.();
    } catch(e) {
      showToast(e.message || "ลบข้อมูลทั้งหมดไม่สำเร็จ", "error");
    } finally {
      setDeletingAll(false);
    }
  }
  async function checkDuplicates() {
    setCheckingDup(true);
    try {
      const res = await fetch(`${API}/api/v1/check-duplicates`);
      const data = await res.json();
      setDupCheck(data);
      showToast(data.has_duplicates
        ? `พบรายการซ้ำ ${data.excess_rows} แถว`
        : "ไม่พบข้อมูลซ้ำ ✓");
    } catch {
      showToast("เช็คไม่สำเร็จ", "error");
    } finally {
      setCheckingDup(false);
    }
  }

  const allMonths = (() => {
    const map = {};
    events.forEach(e => {
      if (!e.date) return;
      const [y,m] = e.date.split("-");
      if (Number(y) < 1900 || Number(y) > 2200) return;
      const key = `${y}-${String(m).padStart(2,"0")}`;
      if (!map[key]) map[key] = key;
    });
    return Object.keys(map).sort().reverse();
  })();

  const allWeeks = (() => {
    const map = {};
    events.forEach(e => { if (!e.date) return; const ws=weekStart(e.date); map[ws]=ws; });
    if (!map[todayWs]) map[todayWs] = todayWs;
    return Object.keys(map).sort().reverse();
  })();

  const filtered = mode==="month"
    ? events.filter(e => {
        const [y,m] = (e.date||"").split("-");
        return `${y}-${String(m).padStart(2,"0")}` === selMonth;
      })
    : events.filter(e => e.date>=selWeek && e.date<=weekEnd(selWeek));

  const zoomCount  = filtered.filter(e =>  e.app?.toLowerCase().includes("zoom") && !e.app?.toLowerCase().includes("team")).length;
  const teamsCount = filtered.filter(e =>  e.app?.toLowerCase().includes("team")).length;
  const otherCount = filtered.filter(e => {
    const a = e.app?.toLowerCase()||"";
    return !a.includes("zoom") && !a.includes("team");
  }).length;
  const changedCount = filtered.filter(e =>
    e.status?.includes("ยกเลิก")||e.status?.includes("ย้าย")
  ).length;

  const GREEN_SHADES = darkMode
    ? ["#34D399","#22C58B","#2DD4BF","#4ADE80","#6EE7B7","#86EFAC","#A7F3D0","#D1FAE5"]
    : ["#1B5E20","#2E7D32","#388E3C","#43A047","#4CAF50","#66BB6A","#81C784","#A5D6A7"];

  const AXIS_TICK_COLOR = darkMode ? "#97979F" : "#888";
  const CHART_TEXT_COLOR = darkMode ? "#EDEDEF" : "#37352F";
  const CHART_TOOLTIP_STYLE = {
    fontSize:12,
    borderRadius:8,
    border: darkMode ? "1px solid rgba(255,255,255,.09)" : "1px solid #eee",
    background: darkMode ? "#17171B" : "#fff",
    color: CHART_TEXT_COLOR,
    boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,.4)" : "0 2px 8px rgba(0,0,0,.08)",
  };
  // Recharts ไม่ inherit สี color จาก contentStyle ไปที่ตัวเลข/label แต่ละแถวเอง
  // ต้องกำหนด itemStyle/labelStyle ตรงๆ ไม่งั้นตัวเลขจะเป็นสีดำของ default ตายตัว มองไม่เห็นตอนพื้นหลังมืด
  const CHART_TOOLTIP_ITEM_STYLE  = { color: CHART_TEXT_COLOR };
  const CHART_TOOLTIP_LABEL_STYLE = { color: CHART_TEXT_COLOR, fontWeight: 600 };

  const donutData = [
    { name:"Zoom",  value:zoomCount },
    { name:"Teams", value:teamsCount },
    { name:"อื่นๆ", value:otherCount },
  ]
    .filter(d=>d.value>0)
    .sort((a,b)=>b.value-a.value)
    .map((d,i)=>({ ...d, color: GREEN_SHADES[Math.min(i, GREEN_SHADES.length-1)] }));

  const deptMap = {};
  filtered.forEach(e => {
    const d = e.department?.trim()||"ไม่ระบุหน่วยงาน";
    deptMap[d] = (deptMap[d]||0)+1;
  });
  const barData = Object.entries(deptMap)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,8)
    .map(([name,count])=>({ name: name.length>15 ? name.slice(0,15)+"…" : name, count }));

  // scope ปัจจุบัน (เดือน/สัปดาห์ ที่กำลังกรองอยู่) → query string เดียวกันใช้ได้ทั้ง PDF และ Excel
  // backend ตีความ year เป็น พ.ศ. เสมอ (year - 543) — ต้อง +543 ก่อนส่ง เหมือน PrintSheet.jsx
  function currentScopeQuery() {
    const year = mode==="month"
      ? parseInt(selMonth.split("-")[0]) + 543
      : parseInt(selWeek.split("-")[0]) + 543;
    return mode==="month"
      ? `year=${year}&month=${parseInt(selMonth.split("-")[1])}`
      : `year=${year}&week_start=${selWeek}&week_end=${weekEnd(selWeek)}`;
  }

  function handleExportPDF() {
    // เปิดหน้ารายงานจาก backend โดยตรง (URL จริงที่แชร์ให้คนอื่นเปิดดูได้)
    // แทนที่จะ build HTML ฝั่ง client แล้วเขียนลงแท็บเปล่า ซึ่งมีอยู่แค่ในเบราว์เซอร์ตัวเอง แชร์ต่อไม่ได้
    const url = `${API}/report/summary?${currentScopeQuery()}`;
    const w = window.open(url, "_blank");
    if (!w) showToast("กรุณาอนุญาต popup เพื่อเปิดหน้ารายงาน", "error");
  }

  function handleExportExcel() {
    window.open(`${API}/events/export-excel?${currentScopeQuery()}`, "_blank");
    showToast("กำลังดาวน์โหลดไฟล์ Excel");
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="rpt-head">
        <div className="rpt-head-title"><Icon name="barChart" size={18}/> รายงานสรุป</div>
        <div className="rpt-head-sub">ข้อมูลการประชุมทางไกลผ่านจอภาพ · ปีงบประมาณ 2569</div>
      </div>

      {/* Filter */}
      <div className="rpt-filter">
        <div className="rpt-toggle">
          <button className={`rpt-toggle-btn${mode==="month"?" active":""}`} onClick={()=>setMode("month")}>รายเดือน</button>
          <button className={`rpt-toggle-btn${mode==="week" ?" active":""}`} onClick={()=>setMode("week")}>รายสัปดาห์</button>
        </div>
        {mode==="month" ? (
          <select className="rpt-selector" value={selMonth} onChange={e=>setSelMonth(e.target.value)}>
            {allMonths.map(m=>{ const [y,mo]=m.split("-"); return <option key={m} value={m}>{MONTHS_TH[parseInt(mo)]} {parseInt(y)+543}</option>; })}
          </select>
        ) : (
          <select className="rpt-selector" value={selWeek} onChange={e=>setSelWeek(e.target.value)}>
            {allWeeks.map(ws=>(
              <option key={ws} value={ws}>
                {ws===todayWs?"สัปดาห์นี้ · ":""}{formatDateTH(ws,true)} – {formatDateTH(weekEnd(ws),true)}
              </option>
            ))}
          </select>
        )}
      </div>

    <div className="export-buttons">
      <button className="btn-export-pdf" onClick={handleExportPDF}>
        <Icon name="fileText" size={16}/> PDF
      </button>
      <button className="btn-export-excel" onClick={handleExportExcel}>
        <Icon name="fileText" size={16}/> Excel
      </button>
    </div>

      {/* KPI Section */}
            <div className="rpt-panel">
              <div className="rpt-panel-title">ตัวชี้วัดผลการดำเนินงาน (KPI)</div>
              <div className="kpi-grid">
                <div className="kpi-card kpi-c1">
                  <div className="kpi-icon-badge"><Icon name="calendar" size={18}/></div>
                  <div className="kpi-value">{filtered.length}</div>
                  <div className="kpi-label">การประชุมทั้งหมด</div>
                  <div className="kpi-sub">{mode==="month"
                    ? (()=>{ const [y,mo]=selMonth.split("-"); return `เดือน${MONTHS_TH[parseInt(mo)]} ${parseInt(y)+543}`; })()
                    : `${formatDateTH(selWeek,true)} – ${formatDateTH(weekEnd(selWeek),true)}`}</div>
                </div>
              <div className="kpi-card kpi-c2">
                 <div className="kpi-icon-badge"><Icon name="clock" size={18}/></div>
                 <div className="kpi-value">
                   {filtered.length > 0
                     ? Math.round(filtered.reduce((acc,e)=>{
                         const {start,end} = parseTimeRange(e.time_raw);
                         return acc + (end-start);
                       },0) / filtered.length)
                     : 0}
                 </div>
                 <div className="kpi-label">นาทีเฉลี่ยต่อครั้ง</div>
                 <div className="kpi-sub">เฉลี่ยต่อการประชุม</div>
            </div>
            <div className="kpi-card kpi-c3">
              <div className="kpi-icon-badge"><Icon name="checkCircle" size={18}/></div>
              <div className="kpi-value">
                {filtered.length > 0
                  ? Math.round(filtered.filter(e=>e.status?.includes("สร้าง link")).length / filtered.length * 100)
                  : 0}%
              </div>
              <div className="kpi-label">พร้อมดำเนินการ</div>
              <div className="kpi-sub">มีลิงค์ประชุมแล้ว</div>
            </div>
            <div className="kpi-card kpi-c4">
              <div className="kpi-icon-badge"><Icon name="users" size={18}/></div>
              <div className="kpi-value">
                {new Set(filtered.map(e=>e.department).filter(Boolean)).size}
              </div>
              <div className="kpi-label">หน่วยงานที่เข้าร่วม</div>
              <div className="kpi-sub">จำนวนหน่วยงานต่างๆ</div>
            </div>
          </div>

          {/* วันที่มีประชุมบ่อย */}
          {(() => {
            const dayCount = [0,0,0,0,0,0,0];
            filtered.forEach(e => {
              if (e.date) dayCount[new Date(e.date+"T00:00:00").getDay()]++;
            });
            const maxDay = dayCount.indexOf(Math.max(...dayCount));
            const dowData = DAYS_SHORT.map((label,i) => ({
              label, full: DAYS_FULL[i], count: dayCount[i], isMax: i===maxDay && dayCount[i]>0,
            }));
            return filtered.length > 0 ? (
              <div className="rpt-daychart-wrap">
                <div className="rpt-daychart-title">
                  <span className="rpt-title-icon"><Icon name="calendar" size={18}/></span>
                  วันที่มีประชุมมากที่สุด
                </div>
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={dowData} margin={{top:8, right:8, left:-8, bottom:0}} barCategoryGap="28%">
                    <defs>
                      <linearGradient id="dowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={darkMode ? "#4F9DFF" : "#2E6FE0"} stopOpacity={1}/>
                        <stop offset="100%" stopColor={darkMode ? "#4F9DFF" : "#2E6FE0"} stopOpacity={0.55}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={darkMode ? "#33343B" : "#EEEFF1"}/>
                    <XAxis dataKey="label"
                      tick={{fontSize:11, fill:AXIS_TICK_COLOR}}
                      tickLine={false}
                      axisLine={{stroke: darkMode ? "#4A4B54" : "#D8DAE0"}}/>
                    <YAxis
                      tick={{fontSize:10, fill:AXIS_TICK_COLOR}}
                      tickLine={false}
                      axisLine={{stroke: darkMode ? "#4A4B54" : "#D8DAE0"}}
                      allowDecimals={false}/>
                    <Tooltip
                      cursor={{fill: darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}}
                      formatter={v => [`${v} ครั้ง`, "จำนวน"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full || ""}
                      contentStyle={CHART_TOOLTIP_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}/>
                    <Bar dataKey="count" fill="url(#dowGrad)" radius={[6,6,0,0]} maxBarSize={36}>
                      {dowData.map((d,i) => (
                        <Cell key={i} fill={d.isMax ? (darkMode ? "#4F9DFF" : "#2E6FE0") : "url(#dowGrad)"}
                          fillOpacity={d.isMax ? 1 : 0.55}/>
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="kpi-insight">
                  <Icon name="barChart" size={14}/>
                  วันที่มีประชุมบ่อยที่สุดคือ <b>{DAYS_FULL[maxDay]}</b> ({dayCount[maxDay]} ครั้ง)
                </div>
              </div>
            )  : null;
          })()}
        </div>

      {/* Stats Cards */}
      <div className="rpt-cards">
        {[
          { label:"ทั้งหมด",       n:filtered.length, icon:"clipboard",     cls:"" },
          { label:"Zoom",           n:zoomCount,       icon:"users",         cls:"rpt-blue" },
          { label:"Teams",          n:teamsCount,      icon:"users",         cls:"rpt-purple" },
          { label:"ยกเลิก/ย้ายวัน", n:changedCount,    icon:"alertTriangle", cls:"rpt-orange" },
        ].map(c=>(
          <div className={`rpt-card ${c.cls}`} key={c.label}>
            <div className="rpt-card-icon"><Icon name={c.icon} size={18}/></div>
            <div className="rpt-card-n">{c.n}</div>
            <div className="rpt-card-l">{c.label}</div>
          </div>
        ))}
      </div>
    <div className="rpt-panels-row"></div>
      {/* Donut chart */}
      {filtered.length>0 && donutData.length>0 && (
        <div className="rpt-panel">
          <div className="rpt-panel-title">สัดส่วนช่องทางประชุม</div>
          <div className="rpt-donut-wrap">
            <div className="rpt-donut-chart" style={{width:180, height:180, flex:"0 0 auto", position:"relative"}}>
              <PieChart width={180} height={180} margin={{top:0,right:0,bottom:0,left:0}}>
                <Pie data={donutData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={56} outerRadius={88} paddingAngle={2}
                  startAngle={90} endAngle={450}>
                  {donutData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip formatter={v=>`${v} รายการ`}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}/>
              </PieChart>
              <div className="rpt-donut-hole">
                <div className="rpt-donut-hole-pct">{Math.round(donutData[0].value/filtered.length*100)}%</div>
                <div className="rpt-donut-hole-lbl">ใช้ {donutData[0].name}<br/>มากที่สุด</div>
              </div>
            </div>
            <div className="rpt-legend">
              {donutData.map(d=>{
                const pct = Math.round(d.value/filtered.length*100);
                const brand = appBrand(d.name);
                return (
                  <div className="rpt-app-row" key={d.name}>
                    <div className="rpt-app-badge" style={{background:brand.color}}>{brand.letter}</div>
                    <div className="rpt-app-main">
                      <div className="rpt-app-top">
                        <span className="rpt-app-name">{d.name}</span>
                        <span className="rpt-app-pct">{pct}%</span>
                      </div>
                      <div className="rpt-app-bottom">
                        <div className="rpt-app-bar-wrap">
                          <div className="rpt-app-bar-fill" style={{width:`${pct}%`, background:d.color}}/>
                        </div>
                        <span className="rpt-app-count">{d.value} ครั้ง</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="rpt-legend-total">รวม {filtered.length} รายการ</div>
            </div>
          </div>
        </div>
      )}

      {/* Area chart — trend รายวัน */}
      {filtered.length > 0 && (
        <div className="rpt-panel">
          <div className="rpt-panel-title">แนวโน้มการประชุมรายวัน</div>
          {(() => {
            // จัดกลุ่มตามวันที่
            const dayMap = {};
            filtered.forEach(e => {
              if (!e.date) return;
              dayMap[e.date] = (dayMap[e.date] || 0) + 1;
            });

            // เรียงตามวันที่และสร้าง array
            const trendData = Object.entries(dayMap)
            .sort(([a], [b])  => a.localeCompare(b))
            .map(([date, count]) => ({
              date,
              label: formatDateTH(date, true),
              count,
            }));

        if (trendData.length < 2) return (
          <div className="empty-day">ข้อมูลน้อยเกินไปสำหรับกราฟนี้</div>
        );

        return (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}
              margin={{top:8, right:8, left:-24, bottom:0}}>
              <defs>
                <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={darkMode ? "#22C58B" : "#1F8A5C"} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={darkMode ? "#22C58B" : "#1F8A5C"} stopOpacity={0}/>
                </linearGradient>
                </defs>
                <XAxis dataKey="label"
                  tick={{fontSize:10, fill:AXIS_TICK_COLOR}}
                  tickLine={false} axisLine={false}
                  interval="preserveStartEnd"/>
                <YAxis
                  tick={{fontSize:10, fill:AXIS_TICK_COLOR}}
                  tickLine={false} axisLine={false}
                  allowDecimals={false}/>
                <Tooltip
                  formatter={v =>[`${v} รายการ`, "จำนวน"]}
                  labelFormatter={l => `วันที่ ${l}`}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}/>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={darkMode ? "#22C58B" : "#1F8A5C"}
                  strokeWidth={2}
                  fill="url(#trendGrad)"
                  dot={{r:3, fill: darkMode ? "#22C58B" : "#1F8A5C", strokeWidth:0}}
                  activeDot={{r:5}}/>
              </AreaChart>
            </ResponsiveContainer>
        );
    })()}
  </div>
)}
      {/* Ranked list — departments */}
      <div className="rpt-panel">
        <div className="rpt-panel-title">หน่วยงานที่เข้าร่วมมากที่สุด</div>
        {barData.length===0 ? (
          <div className="empty-day">ไม่มีข้อมูลในช่วงนี้</div>
        ) : (() => {
          const deptMax = Math.max(...barData.map(d=>d.count)) || 1;
          return (
            <div className="rpt-dept-list">
              {barData.map((d,i)=>(
                <div className={`rpt-dept-row${i<3 ? ` rpt-dept-rank-${i+1}` : ""}`} key={d.name}>
                  <div className="rpt-dept-rank">{i<3 ? <Icon name="mapPin" size={14}/> : i+1}</div>
                  <div className="rpt-dept-info">
                    <div className="rpt-dept-name">{d.name}</div>
                    <div className="rpt-dept-bar-wrap">
                      <div className="rpt-dept-bar-fill" style={{
                        width:`${Math.round(d.count/deptMax*100)}%`,
                        background: i<3 ? undefined : GREEN_SHADES[i % GREEN_SHADES.length],
                      }}/>
                    </div>
                  </div>
                  <div className="rpt-dept-count">{d.count}<span className="rpt-dept-unit">ครั้ง</span></div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

{/* Data Health Check */}
      <div className="rpt-panel">
        <div className="rpt-panel-title">ตรวจสอบความถูกต้องของข้อมูล</div>
        <button className="btn-check-dup" onClick={checkDuplicates} disabled={checkingDup}>
          <Icon name="alertTriangle" size={15}/>
          {checkingDup ? "กำลังตรวจสอบ..." : "เช็คข้อมูลซ้ำ"}
        </button>

        {dupCheck && (
          dupCheck.has_duplicates ? (
            <div className="dup-result dup-result-bad">
              <div className="dup-result-title">
                <Icon name="alertTriangle" size={16}/> พบข้อมูลซ้ำ {dupCheck.duplicate_groups} กลุ่ม ({dupCheck.excess_rows} แถวส่วนเกิน)
              </div>
              <div className="dup-result-list">
                {dupCheck.details.map((d,i)=>(
                  <div className="dup-result-item" key={i}>
                    <span className="dup-result-date">{formatDateTH(d.date,true)}</span>
                    <span className="dup-result-name">{d.title?.substring(0,30)}</span>
                    <span className="dup-result-count">ซ้ำ {d.count} ครั้ง</span>
                  </div>
                ))}
              </div>
              <div className="dup-result-hint">ติดต่อผู้ดูแลระบบเพื่่อลบข้อมูลส่วนเกินผ่าน phpMyAdmin</div>
      </div>
    ) : (
      <div className="dup-result dup-result-good">
        <Icon name="checkCircle" size={16}/> ไม่พบข้อมูลซ้ำ ข้อมูลถูกต้องครบถ้วน
      </div>
    )
  )}
      </div>

      {/* Danger Zone */}
      <div className="rpt-panel rpt-panel-danger">
        <div className="rpt-panel-title" style={{color:"var(--red)"}}>โซนอันตราย</div>
        <div className="danger-zone-body">
          <div className="danger-zone-actions">
            <button className="btn-trash" onClick={openTrash}>
              <Icon name="trash" size={15}/> ถังขยะ
            </button>
            <button className="btn-delete-all" onClick={openDeleteAll}>
              <Icon name="alertTriangle" size={15}/> ลบข้อมูลทั้งหมด
            </button>
          </div>
        </div>

        {/* Modal: ลบทั้งหมด (ยืนยัน 2 ครั้ง) */}
        {showDeleteAll && (
          <div className="sheet-overlay" onClick={()=>!deletingAll && setShowDeleteAll(false)}>
            <div className="sheet" onClick={e=>e.stopPropagation()}>
              <div className="sheet-handle"/>
              {deleteStep === 1 ? (
                <>
                  <div className="danger-modal-icon">
                    <Icon name="alertTriangle" size={28}/>
                  </div>
                  <div className="sheet-title" style={{color:"var(--red)"}}>
                    ยืนยันการลบข้อมูลทั้งหมด
                  </div>
                  <p className="sheet-sub">
                    จะลบข้อมูลทั้งหมด <b>{events.length} รายการ</b><br/>
                    ข้อมูลจะถูกย้ายไปถังขยะและกู้คืนได้ในภายหลัง
                  </p>
                  <button className="btn-delete-all" style={{width:"100%"}} onClick={()=>setDeleteStep(2)}>
                    ดำเนินการต่อ
                  </button>
                  <button className="btn-sheet-close" onClick={()=>setShowDeleteAll(false)}>ยกเลิก</button>
                </>
              ) : (
                <>
                  <div className="danger-modal-icon">
                    <Icon name="alertTriangle" size={28}/>
                  </div>
                  <div className="sheet-title" style={{color:"var(--red)"}}>
                    ยืนยันครั้งสุดท้าย
                  </div>
                  <p className="sheet-sub">
                    พิมพ์คำว่า <b>ลบทั้งหมด</b> เพื่อยืนยันการดำเนินการ
                    </p>
                    <input
                      className="form-input danger-confirm-input"
                      placeholder="พิมพ์ว่า ลบทั้งหมด"
                      value={deleteConfirmText}
                      onChange={e=>setDeleteConfirmText(e.target.value)}
                      style={{width:"100%", textAlign:"center"}}
                      autoFocus
                    />
                    <button
                      className="btn-delete-all" style={{width:"100%"}}
                      onClick={confirmDeleteAllStep2}
                      disabled={deleteConfirmText !== "ลบทั้งหมด" || deletingAll}>
                      {deletingAll ? "กำลังลบ..." : "ยืนยันลบข้อมูลทั้งหมด"}
                        </button>
                        <button className="btn-sheet-close" onClick={()=>setShowDeleteAll(false)} disabled={deletingAll}>ยกเลิก</button>
                  </>
              )}
            </div>
          </div>
        )}

        {/* Modal: ถังขยะ */}
        {showTrash && (
          <div className="sheet-overlay" onClick={()=>setShowTrash(false)}>
            <div className="sheet" onClick={e=>e.stopPropagation()} style={{maxHeight:"70vh"}}>
              <div className="sheet-handle"/>
              <div className="sheet-title"><Icon name="trash" size={18}/> ถังขยะ</div>
              <p className="sheet-sub">รายการที่ถูกลบ กู้คืนได้ที่นี่</p>

              <div className="trash-scroll">
                {loadingTrash ? (
                  <div className="sheet-loading"><span className="spinner-sm"/> กำลังโหลด...</div>
                ) : trashList.length === 0 ? (
                  <div className="empty-day">ถังขยะว่างเปล่า</div>
                ) : (
                  trashList.map(ev => (
                    <div className="trash-item" key={ev.id}>
                      <div className="trash-item-info">
                        <div className="trash-item-title">{ev.title}</div>
                        <div className="trash-item-date">{formatDateTH(ev.date)}</div>
              </div>
              <div className="trash-item-actions">
                <button className="btn-restore" onClick={()=>handleRestore(ev.id)} disabled={restoringId===ev.id}>
                  {restoringId===ev.id ? "..." : <Icon name="checkCircle" size={14}/>}
                </button>
                <button className="btn-purge" onClick={()=>setPurgeId(ev.id)}>
                  <Icon name="xCircle" size={14}/>
                </button>
            </div>
          </div>
        ))
      )}
    </div>

              <button className="btn-sheet-close" onClick={() => setShowTrash(false)}>ปิด</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 24 }} />

      {purgeId !== null && (
        <ConfirmSheet
          title="ลบถาวร"
          message="ไม่สามารถกู้คืนรายการนี้ได้อีกหลังจากลบ"
          confirmLabel="ลบถาวร"
          danger
          busy={purging}
          onConfirm={()=>handlePermanentDelete(purgeId)}
          onCancel={()=>setPurgeId(null)}
        />
      )}
    </div>
  );
}
