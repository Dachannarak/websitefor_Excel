import base64
import hashlib
import hmac
import json
import os

from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter(prefix="/line", tags=["LINE"])


def _verify_signature(body: bytes, signature: str) -> bool:
    """ตรวจสอบ X-Line-Signature ตามสเปคของ LINE (HMAC-SHA256 + base64)
    ต้องตั้ง LINE_CHANNEL_SECRET ใน .env — ถ้าไม่ตั้งไว้จะปฏิเสธทุก request"""
    secret = os.environ.get("LINE_CHANNEL_SECRET", "")
    if not secret or not signature:
        return False
    expected = base64.b64encode(
        hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()
    ).decode("utf-8")
    return hmac.compare_digest(signature, expected)


@router.post("/webhook")
async def line_webhook(request: Request, x_line_signature: str = Header(default="")):
    """รับ event จาก LINE — ใช้ครั้งแรกเพื่อดู Group ID ใน log"""
    raw_body = await request.body()
    if not _verify_signature(raw_body, x_line_signature):
        raise HTTPException(status_code=401, detail="ลายเซ็นไม่ถูกต้อง (X-Line-Signature)")

    try:
        body = json.loads(raw_body)
    except Exception as e:
        print(f"LINE webhook: ไม่สามารถ parse JSON ได้ — {e}", flush=True)
        return {"status": "ok"}

    print("=" * 50, flush=True)
    print("LINE WEBHOOK EVENT:", flush=True)
    print(json.dumps(body, indent=2, ensure_ascii=False), flush=True)
    print("=" * 50, flush=True)

    for event in body.get("events", []):
        source = event.get("source", {})
        source_type = source.get("type")
        if source_type == "group":
            group_id = source.get("groupId")
            print(f"\n>>> GROUP ID พบแล้ว: {group_id}\n", flush=True)
        elif source_type == "user":
            user_id = source.get("userId")
            print(f"\n>>> USER ID พบแล้ว: {user_id}\n", flush=True)

    return {"status": "ok"}
