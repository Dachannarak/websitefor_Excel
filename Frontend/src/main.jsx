import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// ทับสไตล์เดิมบางส่วน จึงต้อง import ท้ายสุด
import './styles/calendar-ui.css'
import './styles/search-ui.css'
import './styles/time-picker-scroll.css'
import './styles/home-ui-2.css'
import './utils/stat-highlight.js'
import './styles/form-chips-grid.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
