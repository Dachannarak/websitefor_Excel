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
