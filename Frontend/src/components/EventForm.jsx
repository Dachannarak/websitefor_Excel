import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";
import { API, ADMIN_HEADERS, deleteEventById } from "../api/events";
import { MONTHS_TH } from "../utils/date";
import { showToast } from "../utils/toast";
import ConfirmSheet from "./ConfirmSheet";
import { ThaiDatePicker } from "../ThaiDatePicker";
import { TimePickerScroll } from "./TimePickerScroll";

// ---------------------------------------------------------------------------
// EventForm — เพิ่ม/แก้ไขรายการ
// ---------------------------------------------------------------------------
export default function EventForm({ event, events, onBack, onSaved }) {
  const isNew = !event?.id;
  const deptList = [...new Set((events||[]).map(e=>e.department).filter(Boolean))].sort();

  // รองรับปุ่ม back ของ browser
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });
  useEffect(() => {
    if (!window.history.state?.form) window.history.pushState({ form: true }, "");
    const handlePop = () => onBackRef.current();
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const [form, setForm] = useState(event ? {...event} : {
    date:"", time_raw:"", title:"", location:"",
    app:"", coordinator:"", department:"", event_type:"",
    book_no:"", status:"", assignee:"",
    zoom_user:"", details:"", month_source:"",
  });
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [err,         setErr]         = useState(null);
  const [fieldErr,    setFieldErr]    = useState({});
  const [success,     setSuccess]     = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kbOffset,    setKbOffset]    = useState(0);

  // มือถือ: คีย์บอร์ดที่เปิดค้างจากช่องกรอกก่อนหน้าบังปุ่ม "บันทึก" บางส่วน ทำให้แตะแล้วไม่โดนปุ่ม
  // ต้องดันปุ่มขึ้นตามความสูงคีย์บอร์ดจริง (visualViewport) ปุ่มถึงจะอยู่เหนือคีย์บอร์ดเสมอ
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    onResize();
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);

  function set(key, val) {
    setForm(f=>({...f,[key]:val}));
    if (fieldErr[key]) setFieldErr(fe=>{ const n={...fe}; delete n[key]; return n; });
  }

  async function handleSave() {
    const missing = {};
    if (!form.title) missing.title = true;
    if (!form.date)  missing.date  = true;
    if (Object.keys(missing).length) {
      setFieldErr(missing);
      setErr("กรุณากรอกข้อมูลในช่องที่ทำเครื่องหมายไว้ให้ครบ");
      return;
    }
    setFieldErr({});
    setSaving(true); setErr(null);
    try {
      const url = isNew ? `${API}/events/` : `${API}/events/${event.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: {"Content-Type":"application/json", ...ADMIN_HEADERS},
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        let detail = "บันทึกไม่สำเร็จ";
        try { detail = (await res.json()).detail || detail; } catch { /* response body wasn't JSON, keep default detail */ }
        throw new Error(detail);
      }
      const data = await res.json();
      setSuccess("บันทึกเรียบร้อยแล้ว");
      showToast(isNew ? "เพิ่มรายการแล้ว" : "บันทึกการแก้ไขแล้ว");
      setTimeout(()=>onSaved(data), 500);
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true); setErr(null);
    try {
      await deleteEventById(event.id);
      showToast("ลบรายการแล้ว", "error");
      onBack();
      if (window.history.state?.form) window.history.back();
    } catch(e) { setErr(e.message); setConfirmOpen(false); }
    finally { setDeleting(false); }
  }

  function renderField(f) {
    const invalid = !!fieldErr[f.key];
    const inputCls = `form-input${invalid ? " form-input-invalid" : ""}`;
    
    if (f.type === "date") {
      return (
        <div className="form-field" key={f.key}>
          <ThaiDatePicker
            label={`${f.label}${f.required ? " *" : ""} (พ.ศ.)`}
            value={form[f.key] || ""}
            onChange={(date) => set(f.key, date)}
          />
          {invalid && <div className="form-field-err">กรุณากรอกข้อมูลนี้</div>}
        </div>
      );
    }
    
    if (f.type === "time") {
      return (
        <div className="form-field" key={f.key}>
          <TimePickerScroll
            label={f.label}
            value={form[f.key] || ""}
            onChange={(time) => set(f.key, time)}
          />
          {invalid && <div className="form-field-err">กรุณากรอกข้อมูลนี้</div>}
        </div>
      );
    }
    
    if (f.type === "chips") {
      return (
        <div className="form-field" key={f.key}>
          <label className="form-label">
            {f.label}{f.required && <span className="form-required"> *</span>}
          </label>
          <div className="form-chips-grid">
            {f.options.map(o=>(
              <button type="button" key={o}
                className={`form-chip ${form[f.key]===o?"form-chip-active":""}`}
                onClick={()=>set(f.key, form[f.key]===o ? "" : o)}
                title={o}>
                {o}
              </button>
            ))}
          </div>
          {f.allowCustom && (
            <input className={`${inputCls} form-chips-custom`}
              value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)}
              placeholder={f.placeholder||"หรือพิมพ์เอง..."}
              autoComplete="off"/>
          )}
          {invalid && <div className="form-field-err">กรุณากรอกข้อมูลนี้</div>}
        </div>
      );
    }
    
    return (
      <div className="form-field" key={f.key}>
        <label className="form-label">
          {f.label}{f.required && <span className="form-required"> *</span>}
        </label>
        {f.type==="textarea" ? (
          <textarea className={`${inputCls} form-textarea`}
            value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)}
            placeholder={f.placeholder||""} rows={3}/>
        ) : f.type==="select" ? (
          <select className={`${inputCls} form-select`}
            value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)}>
            {f.options.map(o=><option key={o} value={o}>{o||"— เลือก —"}</option>)}
          </select>
        ) : f.type==="combo" ? (
          <>
            <input className={inputCls}
              list={`combo-${f.key}`}
              value={form[f.key]||""}
              onChange={e=>set(f.key,e.target.value)}
              placeholder={f.placeholder||"พิมพ์หรือเลือก..."}
              autoComplete="off"/>
            <datalist id={`combo-${f.key}`}>
              {f.options.filter(Boolean).map(o=><option key={o} value={o}/>)}
            </datalist>
          </>
        ) : (
          <input className={inputCls} type={f.type}
            value={form[f.key]||""} onChange={e=>set(f.key,e.target.value)}
            placeholder={f.placeholder||""}/>
        )}
        {invalid && <div className="form-field-err">กรุณากรอกข้อมูลนี้</div>}
      </div>
    );
  }

  const fields = [
    { key:"date",        label:"วันที่",           type:"date",     required:true },
    { key:"time_raw",    label:"เวลา",            type:"time" },
    { key:"title",       label:"ชื่อการประชุม",     type:"textarea", required:true, placeholder:"เช่น ประชุมคณะกรรมการบริหารงาน ครั้งที่ 1/2569" },
    { key:"location",    label:"สถานที่",           type:"text",     placeholder:"เช่น ห้องประชุมชั้น 2 อาคาร H.A. Slade" },
    { key:"app",         label:"App",               type:"chips",    options:["Zoom","Teams","Google Meet","Cisco Webex","LINE"], allowCustom:true, placeholder:"หรือพิมพ์ App อื่น..." },
    { key:"event_type",  label:"ประเภทกิจกรรม",    type:"chips",    options:["ประชุมคณะทำงาน","ประชุมกรม","อมรม"], allowCustom:true, placeholder:"หรือพิมพ์ประเภทอื่น..." },
    { key:"department",  label:"หน่วยงาน",          type:"combo",    options:deptList, placeholder:"พิมพ์หรือเลือกหน่วยงาน..." },
    { key:"coordinator", label:"ผู้ประสานงาน",      type:"text",     placeholder:"ชื่อ/เบอร์ต่อ" },
    { key:"assignee",    label:"ผู้รับผิดชอบ",      type:"text",     placeholder:"ชื่อ-นามสกุล ผู้รับผิดชอบ" },
    { key:"status",      label:"สถานะ",             type:"chips",    options:["สร้าง link แล้ว","รอดำเนินการ","ยกเลิก","ย้ายวัน"] },
    { key:"zoom_user",   label:"บัญชี Zoom/Teams",  type:"text",     placeholder:"เช่น บัญชีหลัก / Host 1" },
    { key:"meeting_link", label:"ลิงก์ประชุม", type:"text", placeholder:"https://zoom.us/j/..." },
    { key:"book_no",     label:"เลขที่หนังสือ",     type:"text",     placeholder:"เช่น ทส 0901.1/ว123" },
    { key:"month_source",label:"เดือน (sheet)",     type:"chips",    options:MONTHS_TH.slice(1) },
    { key:"details",     label:"รายละเอียด",        type:"textarea", placeholder:"วาระการประชุม หรือหมายเหตุเพิ่มเติม" },
  ];

  return (
    <div className="screen detail-screen">
      {/* Header */}
      <div className="form-head">
        <button className="btn-back" onClick={()=>window.history.back()}><Icon name="arrowLeft" size={15}/> กลับ</button>
        <div className="form-head-title-row">
          <span className="form-head-icon"><Icon name={isNew ? "plus" : "edit"} size={18}/></span>
          <div className="form-head-title-col">
            <div className="form-head-title">
              {isNew ? "เพิ่มรายการใหม่" : "แก้ไขรายการ"}
            </div>
            <div className="form-head-sub">
              {isNew ? "กรอกข้อมูลการประชุมให้ครบถ้วน" : "ปรับปรุงข้อมูลการประชุมที่มีอยู่"}
            </div>
          </div>
          <span className="form-head-badge">{isNew ? "ฟอร์มใหม่" : "แก้ไขข้อมูล"}</span>
        </div>
      </div>

      <div className="form-body">
        {/* กลุ่มที่ 1: ข้อมูลหลัก */}
        <div className="form-section-title form-section-c1"><Icon name="clipboard" size={14}/> ข้อมูลการประชุม</div>
        <div className="form-card form-card-c1">
          {fields.filter(f=>["date","time_raw","title"].includes(f.key)).map(renderField)}
        </div>

        {/* กลุ่มที่ 2: สถานที่และ App */}
        <div className="form-section-title form-section-c2"><Icon name="mapPin" size={14}/> สถานที่และช่องทาง</div>
        <div className="form-card form-card-c2">
          {fields.filter(f=>["location","app","event_type"].includes(f.key)).map(renderField)}
        </div>

        {/* กลุ่มที่ 3: ผู้เกี่ยวข้อง */}
        <div className="form-section-title form-section-c3"><Icon name="users" size={14}/> ผู้เกี่ยวข้อง</div>
        <div className="form-card form-card-c3">
          {fields.filter(f=>["department","coordinator","assignee"].includes(f.key)).map(renderField)}
        </div>

        {/* กลุ่มที่ 4: สถานะและรายละเอียด */}
        <div className="form-section-title form-section-c4"><Icon name="settings" size={14}/> สถานะและรายละเอียด</div>
        <div className="form-card form-card-c4">
          {fields.filter(f=>["status","zoom_user","meeting_link","book_no","month_source","details"].includes(f.key)).map(renderField)}
        </div>

        {err      && <div className="form-err"><Icon name="xCircle" size={16}/> {err}</div>}
        {success && <div className="form-success"><Icon name="checkCircle" size={16}/> {success}</div>}

        <div className="form-actions-sticky" style={{ bottom: kbOffset }}>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "กำลังบันทึก..." : <><Icon name="save" size={17}/> บันทึก</>}
          </button>
          {!isNew && (
            <button className="btn-delete" onClick={()=>setConfirmOpen(true)} disabled={deleting}>
              {deleting ? "กำลังลบ..." : <><Icon name="trash" size={16}/> ลบรายการนี้</>}
            </button>
          )}
        </div>

        <div style={{height:32}}/>
      </div>

      {confirmOpen && (
        <ConfirmSheet
          title="ยืนยันการลบรายการนี้?"
          message={form.title ? `"${form.title}" — กู้คืนได้ภายหลังจากถังขยะ` : undefined}
          confirmLabel="ลบรายการ"
          danger
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={()=>setConfirmOpen(false)}
        />
      )}
    </div>
  );
}