import { formatDateTH, getDayCls, dayOfWeekTH } from "./date";
import { getStatusLabel } from "./eventStyle";

// ---------------------------------------------------------------------------
// Print helper
// ---------------------------------------------------------------------------
export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printEvents(evList, scopeLabel) {
  const sorted = [...evList].sort((a,b)=>a.date.localeCompare(b.date));
  const rows = sorted.map(ev=>`
    <tr>
      <td>${escHtml(formatDateTH(ev.date))}</td>
      <td class="${escHtml(getDayCls(ev.date))}">${escHtml(dayOfWeekTH(ev.date))}</td>
      <td>${escHtml(ev.time_raw||"-")}</td>
      <td>${escHtml(ev.title)}</td>
      <td>${escHtml(ev.department||"-")}</td>
      <td>${escHtml(ev.location||"-")}</td>
      <td>${escHtml(ev.app||"-")}</td>
      <td>${escHtml(ev.assignee||"-")}</td>
      <td>${escHtml(getStatusLabel(ev.status))}</td>
      <td class="td-img">${ev.image_url ? `<img src="${escHtml(ev.image_url)}" class="print-thumb" alt=""/>` : "-"}</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8"/>
<title>ตารางการประชุม - ${scopeLabel}</title>
<style>
  @import url ('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Sarabun','Noto Sans Thai',sans-seriff;font-size:11pt;color:#1a1a1a;margin:0;background:#f5f5f5;padding:20px}
  .page{background:#fff;max-width:900px;margin:0 auto;padding:2cm;box-shadow:0 2px 16px rgba(0,0,0,.08)}
  .hdr{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #E8F5E9}
  .hdr-logo{font-size:7pt;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
  .hdr h1{font-size:15pt;font-weight:800;color:#1a1a1a}
  .hdr p{font-size:10pt;color:#666;margin-top:3px}
  .hdr-line{width:50px;height:3px;background:#1B5E20;margin:12px auto}
  .hdr h2{font-size:13pt;font-weight:700;color:#1B5E20;margin-top:6px}
  .hdr h3{font-size:11pt;color:#388E3C;margin-top:4px;font-weight:600}
  .section{margin-bottom:28px}
  .section-title{font-size:11pt;font-weight:800;color:#1B5E20;padding:8px 12px;background:#E8F5E9;border-left:4px solid #1B5E20;border-radius:0 6px 0;margin-bottom:16px;letter-spacing:.3px}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:4px}
  .kpi-box{border:1.5px solid #E8F5E9;border-radius:10px;padding:16px 10px;text-align:center;background:linear-gradient(135deg,#F9FBE7,#E8F5E9)}
  .kpi-box  .num{font-size:26pt;font-weight:800;color:#1B5E20;line-heught:1.1}
  .kpi-box  .lbl{font-size:9pt;color:#555;margin-top:6px;font-weight:600}
  .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .chart-title{font-size:10.5pt;font-weight:700;margin-bottom:10px;color:#222;padding-bottom:4px;border-bottom:1px solid #eee}
  .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .bar-label{font-size:9pt;width:120px;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#444;font-weight:600}
  .bar-wrap{flex:1;background:#E8F5E9;border-radius:4px;height:20px;overflow:hidden}
  .bar-fill{height:100%;background:linear-gradient(90deg,#2E7D32,#4CAF50);border-radius:4px}
  .bar-count{font-size:9pt;color:#1B5E20;width:24px;flex-shrink:0;font-weight:800;text-align:right}
  .day-chart{display:flex;gap:8px;align-items:flex-end;height:90px;padding:0 4px}
  .day-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}
  .day-bar-outer{width:100%;flex:1;background:#E8F5E9;border-radius:4px 4px 0 0;display:flex;align-item:flex-end;overflow:hidden}
  .day-bar-inner{width:100%;background:linear-gradient(180deg,#4CAF50,#1B5E20);border-radius;4px 4px 0 0}
  .day-name{font-size:8pt;color:#666;font-weight:600}
  .day-count{position:absolute;left:50%;transform:translateX(-50%);display:inline-block;vackground:#F1F3F1;color:#3A3A3A;font-weight:600;font-size:9pt;padding:2px 8px;border-radius:10px;white-space:nowrap}
  .day-col.is-max .day-count{background:#E4F0E5;color:#1B5E20;font-weight:700}
  .day-col:first-child .day-count{left:0;transform:translateX(0)}
  .day-col:last-child .day-count{left:auto;right:0;transform:translateX(0)}
  .dept-section{margin-top:0}
  table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-top:4px}
  thead tr{background:linear-gradient(90deg,#1B5E20,#2E7D32)}
  th{color:#fff;padding:8px 10px;text-align:left;font-size:9.5pt;font-weight:700}
  td{border-bottom:1px solid #eee;padding:7px 10px;vertical-align:top;line-height:1.5}
  tr:nth-child(even) td{background:#F9FBE7}
  tr:last-child td{border-bottom:none}
  .status-done{color:#1B5E20;font-weight:700}
  .status-cancel{color:#C62828;font-weight:700}
  .status-moved{color:#E65100;font-weight:700}
  .footer{margin-top:24px;font-size:8pt;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}
  @media print{
    body{background:#fff;padding:0}
    .page{box-shadow:none;padding:1.5cm}
    @page{margin:0;size:A4}
  }
</style>
</head><body>
<div class="page">
<div class="hdr">
  <h1>กรมอุทยานแห่งชาติ สัตว์ป่า และพันธุ์พืช</h1>
  <p class="hdr-center">ศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร</p>
  <div class="hdr-sep"></div>
  <h2>ตารางการประชุมทางไกลผ่านจอภาพ</h2>
  <h3>${scopeLabel}</h3>
  <p class="hdr-count">ทั้งหมด ${sorted.length} รายการ</p>
</div>
<div class="section-title2">
    <span class="section-icon"></span>
    รายการประชุม ({total} รายการ) <span class="section-en">Meeting List</span>
   </div>
<table>
  <thead><tr>
        <th>วันที่</th><th>วัน</th><th>เวลา</th><th>ชื่อการประชุม</th><th>หน่วยงาน</th><th>App</th><th>สถานะ</th>
      </tr></thead>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
  const w = window.open("","_blank");
  if (!w) { alert("กรุณาอนุญาต popup เพื่อเปิดหน้าปริ้น"); return; }
  w.document.write(html);
  w.document.close();

}
