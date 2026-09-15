import { useState, useEffect } from "react";
import Icon from "../Icon";
import { formatDateTH } from "../utils/date";
import { getTrash, restoreEventById, permanentDeleteEventById, restoreAllEvents } from "../api/events";
import { showToast } from "../utils/toast";
import ConfirmSheet from "./ConfirmSheet";
import DetailScreen from "./DetailScreen";

// ---------------------------------------------------------------------------
// TrashScreen — รายการที่ถูกลบ (กู้คืนได้ หรือ ลบถาวร)
// ---------------------------------------------------------------------------
export default function TrashScreen({ onBack, onRestore }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId,  setBusyId]  = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [selected, setSelected] = useState(null);
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false);
  const [restoringAll, setRestoringAll] = useState(false);

  useEffect(() => {
    getTrash()
      .then(setItems)
      .catch(() => showToast("โหลดถังขยะไม่สำเร็จ", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function handleRestore(ev) {
    setBusyId(ev.id);
    try {
      await restoreEventById(ev.id);
      setItems(list => list.filter(i => i.id !== ev.id));
      showToast(`กู้คืน "${ev.title}" แล้ว`);
      onRestore?.();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRestoreAll() {
    setRestoringAll(true);
    try {
      const data = await restoreAllEvents();
      setItems([]);
      showToast(data.message || "กู้คืนรายการทั้งหมดแล้ว");
      onRestore?.();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setRestoringAll(false);
      setConfirmRestoreAll(false);
    }
  }

  async function handlePurge() {
    if (!purgeTarget) return;
    setBusyId(purgeTarget.id);
    try {
      await permanentDeleteEventById(purgeTarget.id);
      setItems(list => list.filter(i => i.id !== purgeTarget.id));
      showToast("ลบถาวรแล้ว", "error");
      setPurgeTarget(null);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusyId(null);
    }
  }

  if (selected) return (
    <DetailScreen
      event={selected}
      events={items}
      onNavigate={setSelected}
      onBack={()=>setSelected(null)}
      isTrashView
      onRestored={()=>{
        setItems(list => list.filter(i => i.id !== selected.id));
        setSelected(null);
        onRestore?.();
      }}
      onDeleted={()=>{
        setItems(list => list.filter(i => i.id !== selected.id));
        setSelected(null);
        showToast("ลบถาวรแล้ว", "error");
      }}
    />
  );

  return (
    <div className="screen detail-screen">
      <div className="form-head">
        <button className="btn-back" onClick={onBack}><Icon name="arrowLeft" size={15}/> กลับ</button>
        <div className="form-head-title-row">
          <span className="form-head-icon"><Icon name="trash" size={18}/></span>
          <div className="form-head-title-col">
            <div className="form-head-title">ถังขยะ</div>
            <div className="form-head-sub">รายการที่ถูกลบ กู้คืนได้ภายในหน้านี้</div>
          </div>
        </div>
      </div>

      <div className="detail-body">
        {loading && <div className="app-loading"><div className="spinner"/></div>}

        {!loading && items.length === 0 && (
          <div className="dup-result dup-result-good">
            <Icon name="checkCircle" size={14} /> ไม่มีรายการในถังขยะ
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="trash-restore-all-bar">
            <button
              className="btn-edit"
              onClick={() => setConfirmRestoreAll(true)}
              disabled={restoringAll}
            >
              <Icon name="history" size={15}/> กู้คืนทั้งหมด ({items.length})
            </button>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="trash-scroll">
            {items.map(ev => (
              <div className="trash-item" key={ev.id} onClick={() => setSelected(ev)}>
                <div className="trash-item-info">
                  <div className="trash-item-title">{ev.title || "(ไม่มีชื่อเรื่อง)"}</div>
                  <div className="trash-item-date">{formatDateTH(ev.date, true)}</div>
                </div>
                <div className="trash-item-actions">
                  <button
                    className="btn-restore"
                    disabled={busyId === ev.id}
                    onClick={(e) => { e.stopPropagation(); handleRestore(ev); }}
                    aria-label="กู้คืน"
                  >
                    <Icon name="history" size={16}/>
                  </button>
                  <button
                    className="btn-purge"
                    disabled={busyId === ev.id}
                    onClick={(e) => { e.stopPropagation(); setPurgeTarget(ev); }}
                    aria-label="ลบถาวร"
                  >
                    <Icon name="x" size={16}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {purgeTarget && (
        <ConfirmSheet
          title="ลบถาวรรายการนี้?"
          message={purgeTarget.title ? `"${purgeTarget.title}" — ไม่สามารถกู้คืนได้อีก` : undefined}
          confirmLabel="ลบถาวร"
          danger
          busy={busyId === purgeTarget.id}
          onConfirm={handlePurge}
          onCancel={() => setPurgeTarget(null)}
        />
      )}

      {confirmRestoreAll && (
        <ConfirmSheet
          title="กู้คืนรายการทั้งหมด?"
          message={`ทั้งหมด ${items.length} รายการในถังขยะจะถูกกู้คืนกลับมา`}
          confirmLabel="กู้คืนทั้งหมด"
          busy={restoringAll}
          onConfirm={handleRestoreAll}
          onCancel={() => setConfirmRestoreAll(false)}
        />
      )}
    </div>
  );
}
