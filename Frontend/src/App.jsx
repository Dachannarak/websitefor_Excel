import { useEffect, useState } from "react";
import "./App.css"; // อย่าลืม import ไฟล์ CSS ของคุณเข้ามาด้วยนะครับ

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/events")
      .then((res) => {
        if (!res.ok) throw new Error("ไม่สามารถเชื่อมต่อข้อมูลได้");
        return res.json();
      })
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // หน้าจอตอนกำลังโหลดข้อมูล (อิงคลาส .state และ .spinner ของคุณ)
  if (loading) {
    return (
      <div className="page">
        <div className="state">
          <div className="spinner"></div>
          <div className="state-title">กำลังโหลดข้อมูล...</div>
          <p>กรุณารอสักครู่</p>
        </div>
      </div>
    );
  }

  // หน้าจอตอนเกิด Error (อิงคลาส .state-error ของคุณ)
  if (error) {
    return (
      <div className="page">
        <div className="state state-error">
          <div className="state-title">เกิดข้อผิดพลาด</div>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* ส่วนหัวของเว็บ (Masthead) */}
      <header className="masthead">
        <span className="eyebrow">ระบบตารางนัดหมาย</span>
        <h1>ตารางการประชุมทางไกลผ่านจอภาพ</h1>
        <p className="subtitle">ประจำปีงบประมาณ พ.ศ. 2569 (ดึงข้อมูลทุกเดือน)</p>
      </header>

      {/* ส่วนเนื้อหาและตาราง */}
      <main className="content">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-no">ลำดับ</th>
                <th className="col-date">เดือน</th>
                <th className="col-date">วันที่</th>
                <th className="col-time">เวลา</th>
                <th>เรื่อง</th>
                <th>สถานที่</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(events) && events.length > 0 ? (
                events.map((event, index) => (
                  <tr key={index}>
                    <td className="col-no">{event.ลำดับที่}</td>
                    {/* ใช้ col-date สำหรับเดือนด้วยเพื่อให้ความกว้างสมดุล */}
                    <td className="col-date" style={{ color: "var(--moss)", fontWeight: "600" }}>
                      {event.เดือน_อ้างอิง}
                    </td>
                    <td className="col-date">{event.วันที่}</td>
                    <td className="col-time">{event.เวลา}</td>
                    <td>{event.เรื่อง}</td>
                    <td>{event.สถานที่}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px" }}>
                    ไม่พบข้อมูลนัดหมาย
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;