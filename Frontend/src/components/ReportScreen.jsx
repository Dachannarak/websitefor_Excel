import { useState } from "react";
import Icon from "../Icon";
import { formatDateTH, MONTHS_TH, toDateStr } from "../utils/date";
import { API, deleteEventById } from "../api/events";
import { showToast } from "../utils/toast";
import { ceToBeYear, beToCeYear } from "../utils/dateUtils";
import ConfirmSheet from "./ConfirmSheet";

// Charts (Recharts)
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// รวมชื่อแอปที่สะกด/พิมพ์ต่างกันแต่หมายถึงแอปเดียวกัน (เช่น "ZOOM (HOST)", "Zoom Co-Host (...)")
// ให้เข้ากลุ่มเดียว — ตรรกะเดียวกับ normalize_app_name ฝั่ง backend (routers/reports.py)
// เพื่อให้กราฟในแอปกับรายงาน PDF นับจำนวนตรงกัน
function normalizeAppName(name) {
  const n = (name || "").trim();
  if (!n) return "อื่นๆ";
  const nLower = n.toLowerCase().replace(/\s+/g, "");
  if (nLower.includes("zoom")) return "Zoom";
  if (nLower.includes("team")) return "MS Teams";
  if (nLower.includes("webex")) return "Webex";
  if (nLower.includes("meet")) return "Google Meet";
  return n;
}

// ---------------------------------------------------------------------------
// ReportScreen — สรุปรายงาน
// ---------------------------------------------------------------------------
export default function ReportScreen({ events, onShowTrash, onDeleteAll, onDataChanged }) {
  const [view, setView] = useState("month"); // "month" | "week"
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(ceToBeYear(new Date().getFullYear()));
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [dupDeleteTarget, setDupDeleteTarget] = useState(null);
  const [deletingDupId, setDeletingDupId] = useState(null);
  const [showAllDepts, setShowAllDepts] = useState(false);

  // ============== KPI SUMMARY ==============
  // event.date เก็บเป็น พ.ศ. เสมอ (YYYY-MM-DD) — ต้องเทียบกับค่า พ.ศ. เท่านั้น ห้ามใช้ Date object ตรงๆ
  const totalEvents = events.length;
  // รายการเฉพาะเดือน/ปีที่เลือกอยู่ — ใช้ scope เดียวกันนี้ให้ทั้ง KPI, การใช้งาน App, และอันดับหน่วยงาน
  // ตรงกัน (เดิมสองส่วนหลังนับจาก events ทั้งหมดทั้งปี ทำให้ตัวเลขไม่ตรงกับ KPI "เดือนนี้")
  const monthEvents = events.filter(e => {
    const [y, m] = (e.date || "").split("-");
    return parseInt(y) === selectedYear && parseInt(m) === selectedMonth;
  });
  const thisMonth = monthEvents.length;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekStartStr = toDateStr(weekStart);
  const weekEndStr = toDateStr(weekEnd);
  const thisWeek = events.filter(e => e.date >= weekStartStr && e.date <= weekEndStr).length;

  const today = toDateStr(new Date());
  const todayEvents = events.filter(e => e.date === today).length;
  const movedEvents = events.filter(e => e.status?.includes("ย้าย")).length;

  // scope ที่กำลังกรองอยู่ (เดือน/สัปดาห์) → query string เดียวกันใช้ได้ทั้ง PDF และ Excel
  function currentScopeQuery() {
    return view === "week"
      ? `year=${selectedYear}&week_start=${weekStartStr}&week_end=${weekEndStr}`
      : `year=${selectedYear}&month=${selectedMonth}`;
  }

  function handleExportPDF() {
    const url = `${API}/report/summary?${currentScopeQuery()}`;
    const w = window.open(url, "_blank");
    if (!w) showToast("กรุณาอนุญาต popup เพื่อเปิดหน้ารายงาน", "error");
  }

  function handleExportExcel() {
    window.open(`${API}/events/export-excel?${currentScopeQuery()}`, "_blank");
    showToast("กำลังดาวน์โหลดไฟล์ Excel");
  }

  function openDeleteAll() {
    setDeleteConfirmText("");
    setShowDeleteAll(true);
  }

  async function confirmDeleteAll() {
    if (deleteConfirmText !== "ลบทั้งหมด") return;
    setDeletingAll(true);
    try {
      await onDeleteAll();
      setShowDeleteAll(false);
    } finally {
      setDeletingAll(false);
    }
  }

  // ============== DAY CHART (Chart by Day) ==============
  const getDayChartData = () => {
    const daysInMonth = new Date(beToCeYear(selectedYear), selectedMonth, 0).getDate();
    const data = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${String(selectedYear).padStart(4, "0")}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const count = events.filter(e => e.date === dateStr).length;
      return { day, count };
    });
    return data;
  };

  // ============== APP DISTRIBUTION (เฉพาะเดือน/ปีที่เลือก) ==============
  const getAppDistribution = () => {
    const apps = {};
    monthEvents.forEach(e => {
      const app = normalizeAppName(e.app);
      apps[app] = (apps[app] || 0) + 1;
    });
    return Object.entries(apps)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  // ============== DEPARTMENT RANKING (เฉพาะเดือน/ปีที่เลือก) ==============
  // แสดงแค่ Top 10 หน่วยงานก่อน — ถ้าเอาทั้งหมดลิสต์จะยาวเกินไปเวลามีหลายสิบหน่วยงาน มีปุ่ม "ดูทั้งหมด" ให้กางดูเพิ่มได้
  const DEPT_RANKING_LIMIT = 10;
  const getFullDepartmentRanking = () => {
    const depts = {};
    monthEvents.forEach(e => {
      if (e.department) {
        depts[e.department] = (depts[e.department] || 0) + 1;
      }
    });
    return Object.entries(depts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  // ============== DUPLICATE CHECK ==============
  const checkDuplicates = () => {
    // key ด้วย title+date+time_raw — กันไม่ให้ชื่อประชุมซ้ำ (เช่น ประชุมประจำสัปดาห์) แต่คนละวัน/เวลา ถูกเข้าใจผิดว่าซ้ำ
    const keyMap = {};

    events.forEach(e => {
      const key = `${e.title}||${e.date}||${e.time_raw || ""}`;
      if (keyMap[key]) {
        keyMap[key].push(e);
      } else {
        keyMap[key] = [e];
      }
    });

    return Object.values(keyMap).filter(items => items.length > 1);
  };

  const duplicateGroups = checkDuplicates();
  const hasDuplicates = duplicateGroups.length > 0;
  const dupItemCount = duplicateGroups.reduce((sum, items) => sum + items.length, 0);

  async function handleDeleteDuplicate() {
    if (!dupDeleteTarget) return;
    setDeletingDupId(dupDeleteTarget.id);
    try {
      await deleteEventById(dupDeleteTarget.id);
      showToast("ลบรายการแล้ว (กู้คืนได้ในถังขยะ)", "error");
      setDupDeleteTarget(null);
      onDataChanged?.();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setDeletingDupId(null);
    }
  }

  // Colors for charts
  const appColors = ["#1F8A5C", "#A5D9C1", "#4FD1C5", "#06B6D4", "#0891B2"];

  const appDistribution = getAppDistribution();
  const appEventsTotal = appDistribution.reduce((sum, a) => sum + a.value, 0);
  const appMaxValue = Math.max(1, ...appDistribution.map(a => a.value));

  const fullDeptRanking = getFullDepartmentRanking();
  const deptRanking = showAllDepts ? fullDeptRanking : fullDeptRanking.slice(0, DEPT_RANKING_LIMIT);
  const deptMaxCount = Math.max(1, ...deptRanking.map(d => d.count));

  return (
    <div className="screen report-screen">
      {/* Header */}
      <div className="rpt-head">
        <div className="rpt-head-title">
          <Icon name="chartBar" size={16} /> รายงานสรุป
        </div>
        <div className="rpt-head-sub">ข้อมูลการประชุมรวมทั้งปีการศึกษา</div>
      </div>

      {/* Filter */}
      <div className="rpt-filter">
        <div className="rpt-toggle">
          <button
            className={`rpt-toggle-btn ${view === "month" ? "active" : ""}`}
            onClick={() => setView("month")}
          >
            รายเดือน
          </button>
          <button
            className={`rpt-toggle-btn ${view === "week" ? "active" : ""}`}
            onClick={() => setView("week")}
          >
            รายสัปดาห์
          </button>
        </div>

        <select
          className="rpt-selector"
          value={selectedMonth}
          onChange={e => setSelectedMonth(parseInt(e.target.value))}
        >
          {MONTHS_TH.slice(1).map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          className="rpt-selector"
          value={selectedYear}
          onChange={e => setSelectedYear(parseInt(e.target.value))}
        >
          {(() => {
            const curYearBE = ceToBeYear(new Date().getFullYear());
            const years = new Set([curYearBE - 2, curYearBE - 1, curYearBE, curYearBE + 1, curYearBE + 2, selectedYear]);
            return [...years].sort((a, b) => a - b).map(y => (
              <option key={y} value={y}>{y}</option>
            ));
          })()}
        </select>
      </div>

      {/* Export Buttons */}
      <div className="export-buttons">
        <button className="btn-export-pdf" onClick={handleExportPDF}>
          <Icon name="filePdf" size={14} /> ส่งออก PDF
        </button>
        <button className="btn-export-excel" onClick={handleExportExcel}>
          <Icon name="fileSpreadsheet" size={14} /> ส่งออก Excel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-c1">
          <div className="kpi-icon-badge">
            <Icon name="calendar" size={16} />
          </div>
          <div className="kpi-value">{thisMonth}</div>
          <div className="kpi-label">เดือนนี้</div>
          <div className="kpi-sub">รายการทั้งหมด</div>
        </div>

        <div className="kpi-card kpi-c2">
          <div className="kpi-icon-badge">
            <Icon name="sun" size={16} />
          </div>
          <div className="kpi-value">{todayEvents}</div>
          <div className="kpi-label">วันนี้</div>
          <div className="kpi-sub">รายการที่กำหนดไว้</div>
        </div>

        <div className="kpi-card kpi-c3">
          <div className="kpi-icon-badge">
            <Icon name="calendar" size={16} />
          </div>
          <div className="kpi-value">{thisWeek}</div>
          <div className="kpi-label">สัปดาห์นี้</div>
          <div className="kpi-sub">รายการทั้งหมด</div>
        </div>

        <div className="kpi-card kpi-c4">
          <div className="kpi-icon-badge">
            <Icon name="alertCircle" size={16} />
          </div>
          <div className="kpi-value">{movedEvents}</div>
          <div className="kpi-label">ย้ายวัน</div>
          <div className="kpi-sub">รายการที่ย้ายแล้ว</div>
        </div>
      </div>

      {/* Day Chart */}
      <div className="rpt-panel">
        <div className="rpt-panel-title">
          <Icon name="trendingUp" size={12} /> รายการต่อวัน
        </div>
        <div className="rpt-daychart-wrap">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getDayChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.1)" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1F8A5C" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* App Distribution */}
      <div className="rpt-panel">
        <div className="rpt-panel-title">
          <Icon name="pie" size={12} /> การใช้งาน App — {MONTHS_TH[selectedMonth]} {selectedYear}
        </div>
        {appEventsTotal === 0 ? (
          <div className="dup-result dup-result-good">
            <Icon name="checkCircle" size={14} /> ไม่มีข้อมูลการประชุมในเดือนนี้
          </div>
        ) : (
        <div className="rpt-donut-wrap">
          <div className="rpt-donut-chart" style={{ position: "relative", width: "200px", height: "200px" }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={appDistribution}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  startAngle={90}
                  endAngle={450}
                >
                  {appDistribution.map((_, i) => (
                    <Cell key={i} fill={appColors[i % appColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="rpt-donut-hole">
              <div className="rpt-donut-hole-pct">{appEventsTotal}</div>
              <div className="rpt-donut-hole-lbl">ทั้งหมด</div>
            </div>
          </div>

          <div className="rpt-legend">
            {appDistribution.map((app, i) => (
              <div key={i} className="rpt-app-row">
                <div className="rpt-app-badge" style={{ backgroundColor: appColors[i % appColors.length] }}>
                  {app.name[0]}
                </div>
                <div className="rpt-app-main">
                  <div className="rpt-app-top">
                    <span className="rpt-app-name">{app.name}</span>
                    <span className="rpt-app-pct">{((app.value / appEventsTotal) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="rpt-app-bottom">
                    <div className="rpt-app-bar-wrap">
                      <div className="rpt-app-bar-fill" style={{ width: `${(app.value / appMaxValue) * 100}%` }}></div>
                    </div>
                    <div className="rpt-app-count">{app.value}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="rpt-legend-total">รวมทั้งหมด {appEventsTotal} รายการ</div>
          </div>
        </div>
        )}
      </div>

      {/* Department Ranking */}
      <div className="rpt-panel">
        <div className="rpt-panel-title">
          <Icon name="award" size={12} /> อันดับหน่วยงาน — {MONTHS_TH[selectedMonth]} {selectedYear}
          {!showAllDepts && fullDeptRanking.length > DEPT_RANKING_LIMIT && ` (Top ${DEPT_RANKING_LIMIT})`}
        </div>
        {fullDeptRanking.length === 0 ? (
          <div className="dup-result dup-result-good">
            <Icon name="checkCircle" size={14} /> ไม่มีข้อมูลการประชุมในเดือนนี้
          </div>
        ) : (
        <>
        <div className="rpt-dept-list">
          {deptRanking.map((dept, i) => (
            <div key={i} className={`rpt-dept-row rpt-dept-rank-${i < 3 ? i + 1 : ""}`}>
              <div className="rpt-dept-rank">{i + 1}</div>
              <div className="rpt-dept-info">
                <div className="rpt-dept-name">{dept.name}</div>
                <div className="rpt-dept-bar-wrap">
                  <div className="rpt-dept-bar-fill" style={{ width: `${(dept.count / deptMaxCount) * 100}%` }}></div>
                </div>
              </div>
              <div className="rpt-dept-count">
                {dept.count}
                <span className="rpt-dept-unit">รายการ</span>
              </div>
            </div>
          ))}
        </div>
        {fullDeptRanking.length > DEPT_RANKING_LIMIT && (
          <button className="btn-check-dup" onClick={() => setShowAllDepts(v => !v)}>
            {showAllDepts ? "ย่อกลับ" : `ดูทั้งหมด (${fullDeptRanking.length})`}
          </button>
        )}
        </>
        )}
      </div>

      {/* Data Health Check */}
      <div className="rpt-panel">
        <div className="rpt-panel-title">
          <Icon name="shield" size={12} /> ตรวจสอบข้อมูล
        </div>
        <button className="btn-check-dup">
          <Icon name="search" size={13} /> เช็คซ้ำ ({dupItemCount})
        </button>

        {hasDuplicates && (
          <div className="dup-result dup-result-bad">
            <div className="dup-result-title">
              <Icon name="alertCircle" size={14} /> พบชื่อเรื่องซ้ำ
            </div>
            <div className="dup-result-list">
              {duplicateGroups.map((items, gi) => (
                <div key={gi} className="dup-result-group">
                  <div className="dup-result-item">
                    <span className="dup-result-name">{items[0].title}</span>
                    <span className="dup-result-count">×{items.length}</span>
                  </div>
                  {items.map(ev => (
                    <div key={ev.id} className="dup-result-sub-item">
                      <span className="dup-result-date">{formatDateTH(ev.date, true)}</span>
                      <button
                        className="dup-result-delete-btn"
                        disabled={deletingDupId === ev.id}
                        onClick={() => setDupDeleteTarget(ev)}
                        aria-label="ลบรายการนี้"
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="dup-result-hint">ตรวจสอบและลบรายการที่ซ้ำกัน</div>
          </div>
        )}

        {!hasDuplicates && (
          <div className="dup-result dup-result-good">
            <Icon name="checkCircle" size={14} /> ไม่พบข้อมูลซ้ำ ข้อมูลสะอาดแล้ว
          </div>
        )}
      </div>

      {dupDeleteTarget && (
        <ConfirmSheet
          title="ลบรายการนี้?"
          message={`"${dupDeleteTarget.title}" — ${formatDateTH(dupDeleteTarget.date, true)} (กู้คืนได้ภายหลังจากถังขยะ)`}
          confirmLabel="ลบรายการ"
          danger
          busy={deletingDupId === dupDeleteTarget.id}
          onConfirm={handleDeleteDuplicate}
          onCancel={() => setDupDeleteTarget(null)}
        />
      )}

      {/* Danger Zone */}
      <div className="rpt-panel rpt-panel-danger">
        <div className="rpt-panel-title">
          <Icon name="alertTriangle" size={12} /> โซนอันตราย
        </div>
        <div className="danger-zone-body">
          <div className="danger-zone-actions">
            <button className="btn-trash" onClick={onShowTrash}>
              <Icon name="trash" size={14} /> ดูถังขยะ
            </button>
            <button className="btn-delete-all" onClick={openDeleteAll}>
              <Icon name="alertCircle" size={14} /> ลบทั้งหมด
            </button>
          </div>
        </div>
      </div>

      {showDeleteAll && (
        <div className="sheet-overlay" onClick={() => !deletingAll && setShowDeleteAll(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="danger-modal-icon">
              <Icon name="alertTriangle" size={26} />
            </div>
            <div className="sheet-title">ยืนยันการลบรายการทั้งหมด?</div>
            <p className="sheet-sub">
              รายการทั้งหมด {totalEvents} รายการจะถูกย้ายไปถังขยะ (กู้คืนได้ภายหลัง) — พิมพ์ "ลบทั้งหมด" เพื่อยืนยัน
            </p>
            <input
              type="text"
              className="danger-confirm-input"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="ลบทั้งหมด"
              disabled={deletingAll}
              autoFocus
            />
            <button
              className="btn-delete"
              onClick={confirmDeleteAll}
              disabled={deleteConfirmText !== "ลบทั้งหมด" || deletingAll}
            >
              {deletingAll ? "กำลังลบ..." : "ลบทั้งหมด"}
            </button>
            <button className="btn-sheet-close" onClick={() => setShowDeleteAll(false)} disabled={deletingAll}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div style={{ height: 32 }} />
    </div>
  );
}