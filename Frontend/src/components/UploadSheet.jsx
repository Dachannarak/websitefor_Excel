import { useState, useRef } from "react";
import Icon from "../Icon";
import { API } from "../api/events";
import { formatDateTH } from "../utils/date";
import { showToast } from "../utils/toast";

// ---------------------------------------------------------------------------
// Upload Sheet
// ---------------------------------------------------------------------------
export default function UploadSheet({ onClose, onImported }) {
  const [uploading, setUploading] = useState(false);
  const [err,       setErr]       = useState(null);
  const [preview,   setPreview]   = useState(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);
  const excelRef = useRef(null);
  const imageRef = useRef(null);

  async function handleExcelSelect(e) {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    setUploading(true); setErr(null); setPreview(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(`${API}/api/v1/preview-excel`, { method:"POST", body:form });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.detail || "อ่านไฟล์ไม่สำเร็จ");
      setPreview(data);
    } catch(e) { setErr(e.message); }
    finally { setUploading(false); }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/v1/import-excel?token=${preview.preview_token}`, { method:"POST" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.detail || "import ไม่สำเร็จ");
      setResult(data);
      showToast("นำเข้าข้อมูลสำเร็จ");
      await onImported();
    } catch(e) { setErr(e.message); }
    finally { setImporting(false); }
  }

  function handleCancelPreview() {
    setPreview(null); setErr(null);
  }

  function handleUploadAnother() {
    setPreview(null); setResult(null); setErr(null);
  }

  async function handleImage(e) {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    setUploading(true); setErr(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(`${API}/api/v1/import-image`, { method:"POST", body:form });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.detail || "upload ไม่สำเร็จ");
      setResult(data);
      showToast("อัปโหลดรูปภาพสำเร็จ");
      await onImported();
    } catch(e) { setErr(e.message); }
    finally { setUploading(false); }
  }

  //---- หน้า Preview ----//
  if (preview) {
    return (
      <div className="sheet-overlay" onClick={handleCancelPreview}>
        <div className="sheet" onClick={e=>e.stopPropagation()}>
          <div className="sheet-handle"/>
          <div className="sheet-title">ตรวจสอบก่อนนำเข้า</div>
          <p className="sheet-sub">พบข้อมูลทั้งหมด {preview.total_rows} รายการ จาก {preview.sheets.length} เดือน</p>

          <div className="preview-summary">
            <div className="preview-stat preview-stat-new">
              <div className="preview-stat-n">{preview.new_count}</div>
              <div className="preview-stat-l">เพิ่มใหม่</div>
            </div>
            <div className="preview-stat preview-stat-update">
              <div className="preview-stat-n">{preview.update_count}</div>
              <div className="preview-stat-l">อัปเดต</div>
            </div>
            <div className="preview-stat preview-stat-invalid">
            <div className="preview-stat-n">{preview.invalid_count}</div>
            <div className="preview-stat-l">ผิดรูปแบบ</div>
            </div>
        </div>

        {preview.skipped_sheets?.length > 0 && (
          <div className="preview-warn">
            <Icon name="alertTriangle" size={14}/> ข้ามชีทที่อ่านไม่ได้: {preview.skipped_sheets.join(", ")}
          </div>
        )}

        {preview.sample_new?.length > 0 && (
          <div className="preview-sample-group">
            <div className="preview-sample-title">ตัวอย่างรายการใหม่</div>
            {preview.sample_new.map((r,i)=>(
              <div className="preview-sample-row" key={i}>
                <span className="preview-sample-date">{formatDateTH(r.date,true)}</span>
                <span className="preview-sample-title-txt">{r.title?.substring(0,30)}</span>
              </div>
            ))}
            {preview.new_count > 5 && <div className="preview-more">และอื่นๆ {preview.new_count-5} รายการ...</div>}
          </div>
        )}

        {err && <div className="sheet-error"><Icon name="xCircle" size={16}/> {err}</div>}
        {result && <div className="sheet-success"><Icon name="checkCircle" size={16}/> {result.message}</div>}

        {!result ? (
          <>
           <button className="btn-file" onClick={handleConfirmImport} disabled={importing}>
             {importing ? "กำลังนำเข้า..." : <><Icon name="checkCircle" size={16}/> ยืนยันนำเข้า {preview.total_rows} รายการ</>}
           </button>
           <button className="btn-sheet-close" onClick={handleCancelPreview} disabled={importing}>ยกเลิก</button>
          </>
        ) : (
          <>
           <button className="btn-file" onClick={handleUploadAnother}>
             <Icon name="upload" size={16}/> อัปโหลดอีกไฟล์
           </button>
           <button className="btn-sheet-close" onClick={onClose}>ปิด</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// หน้าเลือกไฟล์ (ค่าเริ่มต้น)
// ---------------------------------------------------------------------------
return (
  <div className="sheet-overlay" onClick={onClose}>
    <div className="sheet" onClick={e=>e.stopPropagation()}>
      <div className="sheet-handle"/>
      <div className="sheet-title">อัปเดตข้อมูลตาราง</div>
      <p className="sheet-sub">เลือกไฟล์ที่ต้องการนำเข้า - ระบบจะแสดงตัวอย่างให้ตรวจสอบก่อนบันทึกจริง</p>

      <input ref={excelRef} type="file" accept=".xlsx,.xls"
        onChange={handleExcelSelect} disabled={uploading} style={{display:"none"}}/>
      <input ref={imageRef} type="file" accept="image/*"
        onChange={handleImage} disabled={uploading} style={{display:"none"}}/>

      <div className="upload-options">
        <button className={`btn-upload-opt ${uploading?"btn-file-loading":""}`}
         onClick={()=>excelRef.current?.click()} disabled={uploading}>
         <Icon name="fileText" size={20}/>
         <span className="upload-opt-label">ไฟล์ Excel</span>
         <span className="upload-opt-sub">.xlsx / .xls</span>
         </button>
         <button className={`btn-upload-opt ${uploading?"btn-file-loading":""}`}
          onClick={()=>imageRef.current?.click()} disabled={uploading}>
          <Icon name="image" size={20}/>
          <span className="upload-opt-label">รูปภาพอ้างอิง</span>
          <span className="upload-opt-sub">.png / .jpg / .webp</span>
          </button>
        </div>

        {uploading && <div className="sheet-loading"><span className="spinner-sm"/> กำลังประมวลผล...</div>}
        {result && <div className="sheet-success"><Icon name="checkCircle" size={16}/> {result.message}</div>}
        {err    && <div className="sheet-error"><Icon name="xCircle" size={16}/> {err}</div>}
        <button className="btn-sheet-close" onClick={onClose}>ปิด</button>
    </div>
  </div>
 );
}
