import hmac
import os

from fastapi import Header, HTTPException


def require_admin_key(x_admin_key: str = Header(default="")) -> None:
    """เช็ค header X-Admin-Key ก่อนเข้าถึง endpoint ที่ทำลายข้อมูลถาวร (soft-delete-all, permanent delete)
    ต้องตั้ง ADMIN_API_KEY ใน .env — ถ้าไม่ตั้งไว้ endpoint เหล่านี้จะปิดกั้นทุก request"""
    expected = os.environ.get("ADMIN_API_KEY", "")
    # เทียบแบบ constant-time กัน timing attack ไล่เดา key ทีละไบต์
    if not expected or not hmac.compare_digest(x_admin_key, expected):
        raise HTTPException(status_code=401, detail="ไม่มีสิทธิ์เข้าถึง (ต้องใช้ X-Admin-Key ที่ถูกต้อง)")
