// ---------------------------------------------------------------------------
// Theme toggle FAB — เดิมเคยมีเมนูลอย (ปฏิทิน/รายงาน/ค้นหา/เพิ่มใหม่) ซ้ำกับ TabBar
// เหลือเฉพาะสลับโหมดมืด/สว่างซึ่ง TabBar ไม่มี
// ---------------------------------------------------------------------------
export default function FABSpeedDial({ darkMode, onToggleTheme }) {
  return (
    <button
      className="fab-theme fab-theme-float"
      onClick={onToggleTheme}
      aria-label={darkMode ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      title={darkMode ? "โหมดสว่าง" : "โหมดมืด"}>
      {darkMode ? "☀️" : "🌙"}
    </button>
  );
}
