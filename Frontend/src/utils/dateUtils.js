/**
 * แปลงปี ค.ศ. <-> พ.ศ. — ใช้เฉพาะจุดที่ต้องพึ่ง JS Date object (ซึ่งรับได้แค่ปี ค.ศ.)
 * ส่วน format วันที่แบบไทยให้เรียกใช้ formatDateTH ใน ./date แทน (แหล่งเดียว ไม่ซ้ำซ้อน)
 */

export function ceToBeYear(yearCe) {
  return yearCe + 543;
}

export function beToCeYear(yearBe) {
  return yearBe - 543;
}