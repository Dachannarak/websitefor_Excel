import Icon from "../Icon";

// ---------------------------------------------------------------------------
// ConfirmSheet — sheet ยืนยันการทำงาน (แทน window.confirm ของเบราว์เซอร์)
// ---------------------------------------------------------------------------
export default function ConfirmSheet({ title, message, confirmLabel = "ยืนยัน", cancelLabel = "ยกเลิก", danger, busy, onConfirm, onCancel }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-title">
          {danger && <Icon name="alertTriangle" size={17}/>} {title}
        </div>
        {message && <p className="sheet-sub">{message}</p>}
        <button className={danger ? "btn-delete" : "btn-file"} onClick={onConfirm} disabled={busy}>
          {busy ? "กำลังดำเนินการ..." : confirmLabel}
        </button>
        <button className="btn-sheet-close" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
      </div>
    </div>
  );
}
