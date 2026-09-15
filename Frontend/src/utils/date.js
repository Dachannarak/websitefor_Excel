import { beToCeYear, ceToBeYear } from "./dateUtils";

export const MONTHS_TH = ["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
export const DAYS_SHORT = ["อา","จ","อ","พ","พฤ","ศ","ส"];
export const DAYS_FULL  = ["วันอาทิตย์","วันจันทร์","วันอังคาร","วันพุธ","วันพฤหัสบดี","วันศุกร์","วันเสาร์"];
export const DAYS_CLS   = ["day-sun","day-mon","day-tue","day-wed","day-thu","day-fri","day-sat"];

// event.date ในระบบเก็บเป็น พ.ศ. เสมอ (YYYY-MM-DD) — d ที่รับเข้ามาที่นี่คือ Date จริง (ค.ศ.)
export function toDateStr(d) {
  return `${ceToBeYear(d.getFullYear())}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
// สร้าง Date ที่คำนวณปฏิทินถูกต้องจริงจาก dateStr แบบ พ.ศ. (แปลงเป็น ค.ศ. ก่อน เพราะ 543 ไม่ใช่ผลคูณของ 7 — บวกตรงๆ จะได้วันในสัปดาห์ผิด)
function toCeDate(dateStr) {
  const [yBe, m, d] = dateStr.split("-").map(Number);
  return new Date(beToCeYear(yBe), m - 1, d);
}
export function getDayCls(dateStr) {
  if (!dateStr) return "";
  return DAYS_CLS[toCeDate(dateStr).getDay()];
}
export function formatDateTH(dateStr, short=false) {
  if (!dateStr) return "-";
  const [y,m,d] = dateStr.split("-");
  const mi = parseInt(m);
  if (!MONTHS_TH[mi]) return dateStr;
  if (short) return `${parseInt(d)} ${MONTHS_TH[mi].substring(0,3)}.`;
  return `${parseInt(d)} ${MONTHS_TH[mi]} ${parseInt(y)}`;
}
export function dayOfWeekTH(dateStr) {
  if (!dateStr) return "";
  return DAYS_FULL[toCeDate(dateStr).getDay()];
}
// native <input type="date"> คืนค่าเป็น ค.ศ. เสมอ — ต้องแปลงเป็น พ.ศ. ก่อนเทียบกับ event.date
export function ceStrToBeStr(ceStr) {
  if (!ceStr) return "";
  const [y, m, d] = ceStr.split("-");
  return `${ceToBeYear(parseInt(y))}-${m}-${d}`;
}

export function parseTimeRange(timeRaw) {
  const matches = (timeRaw || "").match(/(\d{1,2})[.:](\d{2})/g) || [];
  const toMinutes = (s) => {
    const [h, m] = s.replace(".", ":").split(":").map(Number);
    return h * 60 + (m || 0);
  };
  if (matches.length >= 2) {
    return { start: toMinutes(matches[0]), end: toMinutes(matches[1]) };
  }
  if (matches.length === 1) {
    const start = toMinutes(matches[0]);
    return { start, end: start + 60 };
  }
  return { start: 9 * 60, end: 10 * 60 }; //ไม่มีเวลาเลย -> default 9-10 โมง
}
