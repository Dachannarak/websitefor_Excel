from fastapi import HTTPException, UploadFile


async def read_capped(file: UploadFile, max_bytes: int, error_detail: str) -> bytes:
    """อ่านไฟล์ทีละ chunk แล้วเช็คขนาดระหว่างทาง แทนที่จะ await file.read() รวดเดียว
    เพื่อไม่ให้ไฟล์ใหญ่เกินโควต้าถูกโหลดเข้าหน่วยความจำทั้งก้อนก่อนถูกปฏิเสธ"""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail=error_detail)
        chunks.append(chunk)
    return b"".join(chunks)
