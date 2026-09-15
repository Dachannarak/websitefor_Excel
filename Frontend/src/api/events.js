export const API = "";
// ต้องตรงกับ ADMIN_API_KEY ฝั่ง backend — ใช้กับ endpoint ที่ทำลายข้อมูลถาวร/เรียก AI เท่านั้น
export const ADMIN_HEADERS = { "X-Admin-Key": import.meta.env.VITE_ADMIN_KEY || "" };

// ลบรายการเดียว (soft delete) — ใช้ร่วมกันทุกจุดที่มีปุ่มลบ กันการ parse response ไม่ตรงกันระหว่างจุด
export async function deleteEventById(id) {
  const res  = await fetch(`${API}/events/${id}`, { method:"DELETE", headers:ADMIN_HEADERS });
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error("ลบไม่สำเร็จ");
      throw new Error("รูปแบบข้อมูลตอบกลับไม่ถูกต้อง");
    }
  }
  if (!res.ok) throw new Error(data.detail || "ลบไม่สำเร็จ");
  return data;
}

// ดึงรายการที่อยู่ในถังขยะ
export async function getTrash() {
  const res = await fetch(`${API}/events/trash/list`);
  if (!res.ok) throw new Error("โหลดถังขยะไม่สำเร็จ");
  return res.json();
}

// กู้คืนรายการจากถังขยะ
export async function restoreEventById(id) {
  const res  = await fetch(`${API}/events/${id}/restore`, { method:"POST", headers:ADMIN_HEADERS });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || "กู้คืนไม่สำเร็จ");
  return data;
}

// ลบรายการถาวร (ไม่สามารถกู้คืนได้)
export async function permanentDeleteEventById(id) {
  const res  = await fetch(`${API}/events/${id}/permanent`, { method:"DELETE", headers:ADMIN_HEADERS });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || "ลบถาวรไม่สำเร็จ");
  return data;
}

// ลบรายการทั้งหมด (soft delete)
export async function softDeleteAllEvents() {
  const res  = await fetch(`${API}/events/all/soft-delete-all?confirm=DELETE_ALL_CONFIRMED`, { method:"DELETE", headers:ADMIN_HEADERS });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || "ลบทั้งหมดไม่สำเร็จ");
  return data;
}

// กู้คืนรายการทั้งหมดจากถังขยะ
export async function restoreAllEvents() {
  const res  = await fetch(`${API}/events/all/restore-all`, { method:"POST", headers:ADMIN_HEADERS });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.detail || "กู้คืนทั้งหมดไม่สำเร็จ");
  return data;
}
