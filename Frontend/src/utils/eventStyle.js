function classifyStatus(status="") {
  if (status.includes("สร้าง link")) return "done";
  if (status.includes("ยกเลิก"))    return "cancel";
  if (status.includes("ย้าย"))      return "moved";
  return "wait";
}
const STATUS_CLS   = { done:"s-done", cancel:"s-cancel", moved:"s-moved", wait:"s-wait" };
const STATUS_LABEL = { done:"พร้อมแล้ว", cancel:"ยกเลิก", moved:"ย้ายวัน", wait:"รอดำเนินการ" };
export function getStatusCls(status="") {
  return STATUS_CLS[classifyStatus(status)];
}
export function getStatusLabel(status="") {
  return STATUS_LABEL[classifyStatus(status)];
}
export function getAppCls(app="") {
  const a = app.toLowerCase();
  if (a.includes("team"))  return "app-teams";
  if (a.includes("zoom"))  return "app-zoom";
  if (a.includes("meet"))  return "app-meet";
  if (a.includes("webex")) return "app-webex";
  if (a.includes("line"))  return "app-line";
  return "app-other";
}
export function getAppLabel(app="") {
  return app || "อื่นๆ";
}
export function getEventTypeCls(ev) {
  const t = ev.event_type || "";
  if (t.includes("คณะทำงาน")) return "cat-workgroup";
  if (t.includes("กรม"))      return "cat-department";
  if (t.includes("อบรม") || t.includes("อมรม")) return "cat-training";
  return "";
}
export function getCategoryCls(ev) {
  const status = ev.status || "";
  if (status.includes("ยกเลิก")) return "cat-cancel";
  if (status.includes("ย้าย"))   return "cat-moved";
  const appCls = getAppCls(ev.app);
  return appCls.replace("app-", "cat-");
}
// เลือกไอคอนตามแพลตฟอร์มประชุม
export function getAppIconName(app="") {
  const a = app.toLowerCase();
  if (a.includes("line")) return "messageCircle";
  if (a.includes("team")) return "users";
  if (a.includes("zoom") || a.includes("meet") || a.includes("webex")) return "link";
  return "calendar";
}
