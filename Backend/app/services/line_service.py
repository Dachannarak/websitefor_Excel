import os
import requests

LINE_API_URL = "https://api.line.me/v2/bot/message/push"

def send_line_message(text: str) -> bool:
    """ส่งข้อความแจ้งเตือนไปหา Line User ID ที่ตั้งไว้"""
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.environ.get("LINE_USER_ID")

    if not token or not user_id:
        print("LINE notify: ไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_USER_ID ข้ามการแจ้งเตือน", flush=True)
        return False 

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    payload = {
        "to": user_id,
        "messages": [{"type": "text", "text": text}],
    }

    try:
        res = requests.post(LINE_API_URL, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            print(f"LINE notify: ส่งสำเร็จ - {text[:50]}", flush=True)
            return True
        else:
            print(f"LINE notify: ส่งไม่สำเร็จ ({res.status_code}) - {res.text}", flush=True)
            return False 
    except Exception as e:
        print(f"LINE notify: เกิดข้อผิดพลาด - {e}", flush=True)
        return False    

def send_line_flex(event: dict, action: str = "new") -> bool:
    """ส่งการ์ด Flex Message แจ้งเตือนการประชุม
    action: 'new' (สร้างใหม่) | 'edit' (แก้ไข) | 'delete' (ลบ)
    event: dict ที่มี title, date, time_raw, location, department, app, status
    """
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.environ.get("LINE_USER_ID")
    if not token or not user_id:
        print("LINE notify: ไม่ได้ตั้งค่า token/user_id ข้ามการแจ้งเตือน", flush=True)
        return False

    # หัวการ์ด + สีตาม action
    head = {
        "new":    ("🟢 การประชุมใหม่",      "#1B5E20"),
        "edit":   ("🟡 แก้ไขการประชุม",     "#E65100"),
        "delete": ("🔴 ยกเลิก/ลบการประชุม", "#C62828"),
    }.get(action, ("การแจ้งเตือน", "#1B5E20"))
    title_text, head_color = head

    #แถวข้อมูล (label + value) เฉพาะที่มีค่า
    def row(label, value):
        if not value:
            return None
        return {
            "type": "box", "layout": "baseline", "spacing": "sm",
            "contents": [
                {"type": "text", "text": label, "color": "#888888", "size": "sm", "flex": 2},
                {"type": "text", "text": str(value), "color": "#333333", "size": "sm", "flex": 5, "wrap": True},
            ],
        }    

    info_rows = [r for r in [
        row("วันที่", event.get("date")),
        row("เวลา", event.get("time_raw")),
        row("สถานที่", event.get("location")),
        row("หน่วยงาน", event.get("department")),
        row("แพลตฟอร์ม", event.get("app")),
    ] if r]

    bubble = { 
        "type": "bubble",
        "header": {
            "type" : "box", "layout": "vertical", "backgroundColor": head_color,
            "paddingAll": "16px",
            "contents": [
                {"type": "text", "text": title_text, "color": "#ffffff", "weight": "bold", "size": "lg"},
            ],
        },
        "body": {
             "type": "box", "layout": "vertical", "spacing": "md", "paddingAll": "16px",
            "contents": [
                {"type": "text", "text": event.get("title") or "-",
                 "weight": "bold", "size": "md", "wrap": True, "color": "#111111"},
                {"type": "separator", "margin": "md"},
                {"type": "box", "layout": "vertical", "spacing": "sm", "margin": "md",
                 "contents": info_rows or [{"type": "text", "text": "ไม่มีข้อมูลเพิ่มเติม", "size": "sm", "color": "#999999"}]},
            ],
        },
    }

    #ปุ่มลิงก์ประชุม (เฉพาะถ้ามีและไม่ใช่การลบ)
    link = event.get("meeting_link")
    if link and action != "delete":
        bubble["footer"] = {
            "type": "box", "layout": "vertical", "paddingAll": "12px",
            "contents": [
                {"type": "button", "style": "primary", "color": head_color,
                 "action": {"type": "uri", "label": "เข้าร่วมประชุม", "uri": link}},
            ],
        }
    payload = {
        "to": user_id,
        "messages": [{
            "type": "flex",
            "altText": f"{title_text}: {event.get('title') or '-'}",
            "contents": bubble,
        }],
    }    

    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    try:
        res = requests.post(LINE_API_URL, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            print(f"LINE flex: ส่งสำเร็จ - {event.get('title')}", flush=True)
            return True 
        print(f"LINE flex: ส่งไม่สำเร็จ - ({res.status_code}) - {res.text}", flush=True)
        return False
    except Exception as e:
        print(f"LINE flex: เกิดข้อผิดพลาด - {e}", flush=True)
        return False

def _minimal_badge(label, accent):
    """แถบสถานะเล็กๆ แบบจุดสี + ข้อความ (แทนหัวการ์ดสีทึบ)"""
    return {
        "type": "box", "layout": "horizontal", "spacing": "xs", "alignItems": "center",
        "contents": [
            {"type": "text", "text": "●", "size": "xs", "color": accent, "flex": 0},
            {"type": "text", "text": label, "size": "xs", "color": accent, "weight": "bold", "flex": 0},
        ],
    }


def _minimal_row(icon, label, value):
    """แถวข้อมูลแบบ label เล็กด้านบน + value ด้านล่าง โทนเทาเรียบ"""
    if not value:
        return None
    return {
        "type": "box", "layout": "horizontal", "spacing": "md",
        "contents": [
            {"type": "text", "text": icon, "size": "sm", "flex": 0, "color": "#B0B6BB"},
            {"type": "box", "layout": "vertical", "flex": 1, "spacing": "xs",
             "contents": [
                 {"type": "text", "text": label, "size": "xs", "color": "#9AA1A6"},
                 {"type": "text", "text": str(value), "size": "sm", "color": "#26292B", "wrap": True},
             ]},
        ],
    }


def send_line_flex_new(ev) -> bool:
    """การ์ด Flex 'เพิ่มการประชุม' สไตล์มินิมอล (พื้นขาว + accent น้ำเงิน) + fallback text"""
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.environ.get("LINE_USER_ID")
    if not token or not user_id:
        print("LINE flex: ไม่ได้ตั้งค่า token/user_id", flush=True)
        return False

    frontend = os.environ.get("FRONTEND_URL", "")
    accent = "#1565C0"

    info_rows = [r for r in [
        _minimal_row("📅", "วันที่", getattr(ev, "date", None)),
        _minimal_row("🕐", "เวลา", getattr(ev, "time_raw", None)),
        _minimal_row("📍", "สถานที่", getattr(ev, "location", None)),
        _minimal_row("🏢", "หน่วยงาน", getattr(ev, "department", None)),
        _minimal_row("👤", "ผู้รับผิดชอบ", getattr(ev, "assignee", None)),
    ] if r]

    body_contents = [
        _minimal_badge("การประชุมใหม่", accent),
        {"type": "text", "text": getattr(ev, "title", None) or "-",
         "weight": "bold", "size": "xl", "wrap": True, "color": "#111111", "margin": "md"},
        {"type": "separator", "margin": "lg", "color": "#EDEEF0"},
        {"type": "box", "layout": "vertical", "spacing": "lg", "margin": "lg",
         "contents": info_rows or [{"type": "text", "text": "ไม่มีข้อมูลเพิ่มเติม", "size": "sm", "color": "#9AA1A6"}]},
    ]

    bubble = {
        "type": "bubble",
        "body": {
            "type": "box", "layout": "vertical", "paddingAll": "20px",
            "backgroundColor": "#FFFFFF",
            "contents": body_contents,
        },
    }

    # ปุ่ม action
    buttons = []
    mlink = getattr(ev, "meeting_link", None)
    if mlink and str(mlink).strip().startswith(("http://", "https://")):
        buttons.append({
            "type": "button", "style": "primary", "color": "#1565C0", "height": "sm",
            "action": {"type": "uri", "label": "เข้าร่วมการประชุม", "uri": str(mlink).strip()},  
        })
    if frontend and str(frontend).strip().startswith(("http://", "https://")):
        buttons.append({
            "type": "button",
            "style": "primary" if not buttons else "secondary",  # ปุ่มแรกทึบ ปุ่มสองจาง
            "color": "#1565C0" if not buttons else None,
            "height": "sm",
            "action": {"type": "uri", "label": "เปิดรายละเอียดในระบบ", "uri": str(frontend).strip()},
        }) 
    # ลบ key color=None ออก (Line ไม่รับ None)
    for b in buttons:
        if b.get("color") is None:
            b.pop("color", None)
    if buttons:
        bubble["footer"] = {
            "type": "box", "layout": "vertical", "spacing": "sm", "paddingAll": "12px",
            "contents": buttons,
        }               
    # ปุ่ม uri ต้องเป็น URL ที่ขึ้นต้น http:// หรือ https:// เท่านั้น ไม่งั้น LINE ปฏิเสธทั้งการ์ด
    
        bubble["styles"] = {"footer": {"separator": True, "separatorColor": "#EDEEF0"}}

    payload = {
        "to": user_id,
        "messages": [{
            "type": "flex",
            "altText": f"เพิ่มการประชุม: {getattr(ev, 'title', None) or '-'}",
            "contents": bubble,
        }],
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

    try:
        res = requests.post(LINE_API_URL, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            print(f"LINE flex: เพิ่ม ส่งสำเร็จ - {getattr(ev, 'title', None)}", flush=True)
            return True
        print(f"LINE flex: เพิ่ม ไม่ผ่าน ({res.status_code}) {res.text} → fallback", flush=True)
    except Exception as e:
        print(f"LINE flex: เพิ่ม error {e} → fallback", flush=True)

    lines = ["เพิ่มการประชุม", f"เรื่อง: {getattr(ev,'title',None) or '-'}",
             f"วันที่: {getattr(ev,'date',None) or '-'}", f"เวลา: {getattr(ev,'time_raw',None) or '-'}"]
    if getattr(ev, "location", None):   lines.append(f"สถานที่: {ev.location}")
    if getattr(ev, "department", None): lines.append(f"หน่วยงาน: {ev.department}")
    return send_line_message("\n".join(lines))

def send_line_flex_ready(ev) -> bool:
    """การ์ด Flex 'การประชุมพร้อมแล้ว' (มีลิงก์เข้าร่วม) สไตล์มินิมอล (พื้นขาว + accent เขียว) + fallback text
    ยิงตอน status เปลี่ยนเป็น 'สร้าง link แล้ว' — ไม่ใช่ตอนประชุมจบ"""
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.environ.get("LINE_USER_ID")
    if not token or not user_id:
        print("LINE flex: ไม่ได้ตั้งค่า token/user_id", flush=True)
        return False

    accent = "#1B5E20"
    info_rows = [r for r in [
        _minimal_row("📅", "วันที่", getattr(ev, "date", None)),
        _minimal_row("🕐", "เวลา", getattr(ev, "time_raw", None)),
        _minimal_row("📍", "สถานที่", getattr(ev, "location", None)),
    ] if r]

    bubble = {
        "type": "bubble",
        "body": {
            "type": "box", "layout": "vertical", "paddingAll": "20px",
            "backgroundColor": "#FFFFFF",
            "contents": [
                _minimal_badge("การประชุมพร้อมแล้ว", accent),
                {"type": "text", "text": getattr(ev, "title", None) or "-",
                 "weight": "bold", "size": "xl", "wrap": True, "color": "#111111", "margin": "md"},
                {"type": "separator", "margin": "lg", "color": "#EDEEF0"},
                {"type": "box", "layout": "vertical", "spacing": "lg", "margin": "lg",
                 "contents": info_rows or [{"type": "text", "text": "ไม่มีข้อมูลเพิ่มเติม", "size": "sm", "color": "#9AA1A6"}]},
            ],
        },
    }

    link = getattr(ev, "meeting_link", None)
    if link and str(link).strip().startswith(("http://", "https://")):
        bubble["footer"] = {
            "type": "box", "layout": "vertical", "paddingAll": "12px", "spacing": "sm",
            "contents": [
                {"type": "button", "style": "primary", "color": accent, "height": "sm",
                 "action": {"type": "uri", "label": "เข้าร่วมประชุม", "uri": str(link).strip()}},
            ],
        }
        bubble["styles"] = {"footer": {"separator": True, "separatorColor": "#EDEEF0"}}

    payload = {
        "to": user_id,
        "messages": [{
            "type": "flex",
            "altText": f"การประชุมพร้อมแล้ว: {getattr(ev, 'title', None) or '-'}",
            "contents": bubble,
        }],
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

    try:
        res = requests.post(LINE_API_URL, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            print(f"LINE flex: พร้อมแล้ว ส่งสำเร็จ - {getattr(ev, 'title', None)}", flush=True)
            return True
        print(f"LINE flex: พร้อมแล้ว ไม่ผ่าน ({res.status_code}) {res.text} → fallback", flush=True)
    except Exception as e:
        print(f"LINE flex: พร้อมแล้ว error {e} → fallback", flush=True)

    lines = ["การประชุมพร้อมแล้ว", f"เรื่อง: {getattr(ev,'title',None) or '-'}",
             f"วันที่: {getattr(ev,'date',None) or '-'}", f"เวลา: {getattr(ev,'time_raw',None) or '-'}"]
    if link: lines.append(f"ลิงก์: {link}")
    return send_line_message("\n".join(lines))


def send_line_flex_delete(ev) -> bool:
    """การ์ด Flex แจ้ง 'ยกเลิก/ลบการประชุม' สไตล์มินิมอล (พื้นขาว + accent แดง) + fallback text"""
    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.environ.get("LINE_USER_ID")
    if not token or not user_id:
        print("LINE flex: ไม่ได้ตั้งค่า token/user_id", flush=True)
        return False

    accent = "#C62828"
    info_rows = [r for r in [
        _minimal_row("📅", "วันที่", getattr(ev, "date", None)),
        _minimal_row("🕐", "เวลา", getattr(ev, "time_raw", None)),
        _minimal_row("🏢", "หน่วยงาน", getattr(ev, "department", None)),
    ] if r]

    bubble = {
        "type": "bubble",
        "body": {
            "type": "box", "layout": "vertical", "paddingAll": "20px",
            "backgroundColor": "#FFFFFF",
            "contents": [
                _minimal_badge("ยกเลิก / ลบการประชุม", accent),
                {"type": "text", "text": getattr(ev, "title", None) or "-",
                 "weight": "bold", "size": "xl", "wrap": True, "color": "#111111", "margin": "md",
                 "decoration": "line-through"},
                {"type": "separator", "margin": "lg", "color": "#EDEEF0"},
                {"type": "box", "layout": "vertical", "spacing": "lg", "margin": "lg",
                 "contents": info_rows or [{"type": "text", "text": "-", "size": "sm", "color": "#9AA1A6"}]},
                {"type": "box", "layout": "vertical", "margin": "xl", "paddingAll": "10px",
                 "backgroundColor": "#FDEDED", "cornerRadius": "8px",
                 "contents": [
                     {"type": "text", "text": "กรุณาแจ้งผู้เกี่ยวข้องทราบด้วย",
                      "size": "xs", "color": accent, "wrap": True},
                 ]},
            ],
        },
    }

    payload = {
        "to": user_id,
        "messages": [{
            "type": "flex",
            "altText": f"🔴 ยกเลิกการประชุม: {getattr(ev, 'title', None) or '-'}",
            "contents": bubble,
        }],
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

    try:
        res = requests.post(LINE_API_URL, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            print(f"LINE flex: ลบ ส่งสำเร็จ - {getattr(ev, 'title', None)}", flush=True)
            return True
        print(f"LINE flex: ลบ ไม่ผ่าน ({res.status_code}) {res.text} → fallback", flush=True)
    except Exception as e:
        print(f"LINE flex: ลบ error {e} → fallback", flush=True)

    lines = ["🔴 ยกเลิก/ลบการประชุม", f"เรื่อง: {getattr(ev,'title',None) or '-'}",
             f"วันที่: {getattr(ev,'date',None) or '-'} เวลา {getattr(ev,'time_raw',None) or '-'}",
             f"หน่วยงาน: {getattr(ev,'department',None) or '-'}", "", "กรุณาแจ้งผู้เกี่ยวข้องทราบด้วย"]
    return send_line_message("\n".join(lines))

#label ไทยแต่ละ Field 
_FIELD_LABELS = {
    "title": "ชื่อเรื่อง", "date": "วันที่", "time_raw": "เวลา",
    "location": "สถานที่", "department": "หน่วยงาน",
    "coordinator": "ผู้ประสานงาน", "assignee": "ผู้รับผิดชอบ",
    "app": "แพลตฟอร์ม", "meeting_link": "ลิงก์ประชุม",
    "book_no": "เลขที่หนังสือ", "status": "สถานะ", "details": "รายละเอียด",
}

def send_line_flex_change(ev, changes: dict) -> bool:
    """กรา์ด flex แจ้งการแก้ไข - รับ changes = {field: (old, new)} + fallback text
    - details โชว์แค่ 'มีการแก้ไข' ไม่โชว์ข้อความยาว
    - หัวการ์ดปรับตามว่าแก้อะไร"""
    if not changes:
        print("LINE flex: ไม่มี field เปลี่ยน ข้ามแจ้งเตือน", flush=True)
        return False

    token = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
    user_id = os.environ.get("LINE_USER_ID")
    if not token or not user_id:
        print("LINE flex: ไม่ได้ตั้งค่า token/user_id ข้ามการแจ้งเตือน", flush=True)
        return False

    accent = "#E65100"

    #หัวการ์ด: แก้แค่ วัน/เวลา = เลื่อนกำหนดการ, มีอย่างอื่น = แก้ไขข้อมูล
    only_datetime = set(changes.keys()) <= {"date", "time_raw"}
    head_text = "เลื่อนกำหนดการประชุม" if only_datetime else "แก้ไขข้อมูลการประชุม"

    # แถวแต่ละ field ที่เปลี่ยน
    rows = []
    for key, (old_v, new_v) in changes.items():
        label = _FIELD_LABELS.get(key, key)
        if key == "details":
            # รายละเอียด: แจ้งแค่ว่าแก้ไข
            rows.append({
                "type": "box", "layout": "baseline", "spacing": "sm", "margin": "lg",
                "contents": [
                    {"type": "text", "text": label, "color": "#8a938b", "size": "sm", "flex": 3},
                    {"type": "text", "text": "มีการแก้ไข", "color": accent, "size": "sm", "flex": 7, "weight": "bold", "wrap": True},
                ],
            })
        else:
            # field ปกติ: เก่า -> ใหม่ (ใช้ span หลายสีในบรรทัดเดียว กัน box ซ้อน)
            rows.append({
                "type": "box", "layout": "baseline", "spacing": "sm", "margin": "lg",
                "contents": [
                    {"type": "text", "text": label, "color": "#8a938b", "size": "sm", "flex": 3},
                    {"type": "text", "flex": 7, "size": "sm", "wrap": True, "contents": [
                        {"type": "span", "text": str(old_v or "-"), "color": "#999999", "decoration": "line-through"},
                        {"type": "span", "text": "  →  ", "color": accent},
                        {"type": "span", "text": str(new_v or "-"), "color": accent, "weight": "bold"},
                    ]},
                ],
            })
    bubble = {
        "type": "bubble",
        "body": {
            "type": "box", "layout": "vertical", "paddingAll": "20px", "backgroundColor": "#FFFFFF",
            "contents": [
                _minimal_badge(head_text, accent),
                {"type": "text", "text": getattr(ev, "title", None) or "-",
                 "weight": "bold", "size": "xl", "wrap": True, "color": "#111111"},
                {"type": "separator", "margin": "lg", "color": "#EDEEF0"},
                {"type": "box", "layout": "vertical", "spacing": "sm", "margin": "sm",
                 "contents": rows},
            ],
        },
    }

    payload = {
        "to": user_id,
        "messages": [{
            "type": "flex",
            "altText": f"🟡 {head_text}: {getattr(ev, 'title', None) or '-'}",
            "contents": bubble,
        }],
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

    try:
        res = requests.post(LINE_API_URL, headers=headers, json=payload, timeout=10)
        if res.status_code == 200:
            print(f"LINE flex: แก้ไข ส่งสำเร็จ - {getattr(ev, 'title', None)}", flush=True)
            return True
        print(f"LINE flex: แก้ไข ไม่ผ่าน ({res.status_code}) {res.text} -> fallback", flush=True)
    except Exception as e:
        print(f"LINE flex: แก้ไข error {e} -> fallback", flush=True)

    #fallback text
    lines = [f"🟡 {head_text}", f"เรื่อง: {getattr(ev,'title',None) or '-'}"]
    for key, (old_v, new_v) in changes.items():
        label = _FIELD_LABELS.get(key, key)
        if key == "details":
            lines.append(f"{label}: มีการแก้ไข")
        else:
            lines.append(f"{label}: {old_v or '-'} -> {new_v or '-'}")
    return send_line_message("\n".join(lines))