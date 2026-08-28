from pathlib import Path
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import io

app = FastAPI()

# ตั้งค่า CORS ให้ React (Vite) เข้าถึงได้
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # URL ของ React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
FILE_PATH = BASE_DIR / "69_ตาราง Conference ปีงบประมาณ  พ.ศ. 2569.xlsx"

# ---------------------------------------------------------
# ฟังก์ชันหลักสำหรับแกะข้อมูล Excel (อ่านได้ทั้งไฟล์ในเครื่อง และไฟล์ที่อัปโหลด)
# ---------------------------------------------------------
def extract_all_events(source):
    xls = pd.ExcelFile(source)
    
    # ระบุ Sheet ที่เรา "ไม่ต้องการ" นำมาแสดง
    excluded_sheets = [
        'จำนวน Conference', 'ห้องประชุม', 'รหัส User Zoom ใหม่ ', 
        'Zoom_2569', 'อุปกรณ์', 'ประเภทตำแหน่งของบุคลากร ศทส.'
    ]
    
    all_data = []
    
    for sheet_name in xls.sheet_names:
        if sheet_name in excluded_sheets:
            continue
            
        # skiprows=1 เพื่อข้ามหัวตารางบรรทัดแรกสุดของทุก Sheet
        df = pd.read_excel(xls, sheet_name=sheet_name, skiprows=1)
        
        # ตัดคอลัมน์เกิน และตั้งชื่อคอลัมน์ให้เป็นมาตรฐานเดียวกัน
        if len(df.columns) >= 13:
            df = df.iloc[:, :13]
            df.columns = [
                'ลำดับที่', 'วันที่', 'เวลา', 'เรื่อง', 'สถานที่', 'ผู้ประสานงาน',
                'App', 'หน่วยงาน', 'เลขที่หนังสือ', 'สถานะ', 'ผู้รับผิดชอบ', 'User_Zoom', 'รายละเอียด'
            ]
        else:
            continue

        # 1. ลบแถวที่ไม่มีวันที่ หรือ ไม่มีเรื่องทิ้งไป
        df = df.dropna(subset=['วันที่', 'เรื่อง'])
        
        # 2. ลบแถวที่เป็นหัวข้อขั้นเดือน (เช่น แถวที่เขียนว่า "เดือนตุลาคม 2568")
        df = df[~df['ลำดับที่'].astype(str).str.contains('เดือน', na=False)]
        
        df = df.reset_index(drop=True)
        df['ลำดับที่'] = df.index + 1
        
        # 3. เติมค่าว่างด้วย string เปล่า (Frontend จะได้ไม่พังเวลาเจอ null)
        df = df.fillna("")
        
        # 4. แปะชื่อเดือนเข้าไปด้วย Frontend จะได้รู้ว่ามาจาก Sheet ไหน
        df['เดือน_อ้างอิง'] = sheet_name
        
        # แปลงเป็น List of Dictionaries แล้วนำไปต่อท้ายข้อมูลรวม
        all_data.extend(df.to_dict(orient="records"))
        
    return all_data

# ---------------------------------------------------------
# API Routes
# ---------------------------------------------------------

@app.get("/")
def home():
    return {"message": "Conference API Running"}

# API เดิมของคุณ (อัปเกรดให้ดึงข้อมูลทุกเดือนแล้ว)
@app.get("/events")
def get_events():
    try:
        data = extract_all_events(FILE_PATH)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"อ่านไฟล์ล้มเหลว: {str(e)}")

# API ใหม่ สำหรับเตรียมให้ Frontend ทำหน้าจอ "อัปโหลด Excel"
@app.post("/api/v1/import-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="กรุณาอัปโหลดไฟล์ Excel เท่านั้น")
    
    try:
        contents = await file.read()
        # ส่งข้อมูล bytes ให้ฟังก์ชันเดียวกันประมวลผลได้เลย
        data = extract_all_events(io.BytesIO(contents))
        
        return {
            "success": True,
            "message": "อ่านไฟล์ Excel สำเร็จ",
            "total_records": len(data),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))