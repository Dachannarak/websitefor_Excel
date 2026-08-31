import Icon from "../Icon";

// ---------------------------------------------------------------------------
// Tab Bar
// ---------------------------------------------------------------------------
export default function TabBar({ tab, setTab, onNew }) {
  const tabs=[
    {id:"home",     icon:"home",     label:"หน้าแรก"},
    {id:"calendar", icon:"calendar", label:"ปฏิทิน"},
    {id:"report",   icon:"barChart", label:"รายงาน"},
    {id:"search",   icon:"search",   label:"ค้นหา"},
  ];
  return (
    <nav className="tabbar">
      {tabs.map(t=>(
        <button key={t.id} className={`tab-btn ${tab===t.id?"tab-active":""}`} onClick={()=>setTab(t.id)}>
          <span className="tab-icon"><Icon name={t.icon} size={20}/></span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
      <button className="tab-btn tab-btn-new" onClick={onNew}>
        <span className="tab-icon"><Icon name="plus" size={20}/></span>
        <span className="tab-label">เพิ่มใหม่</span>
      </button>
    </nav>
  );
}
