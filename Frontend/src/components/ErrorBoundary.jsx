import { Component } from "react";
import Icon from "../Icon";

// ---------------------------------------------------------------------------
// Error Boundary — กันหน้าจอขาวเวลามี error ที่ไม่คาดคิด
// ---------------------------------------------------------------------------
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error(error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-loading">
        <Icon name="alertTriangle" size={32}/>
        <div>เกิดข้อผิดพลาด ลองโหลดหน้าใหม่</div>
        <button className="btn-sheet-close" onClick={()=>{ this.setState({error:null}); window.location.reload(); }}>
          โหลดใหม่
        </button>
      </div>
    );
  }
}
