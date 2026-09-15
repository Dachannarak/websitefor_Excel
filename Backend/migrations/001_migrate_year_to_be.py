import sys
import mysql.connector
from datetime import datetime

# กัน UnicodeEncodeError ตอน print อีโมจิ/ตัวอักษรไทยบน Windows console ที่ default เป็น cp874/cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def migrate_year_to_be():
    """
    Migrate year ค.ศ. → พ.ศ. (add 543 to year)
    
    Before: 2026-08-14 (ค.ศ.)
    After:  2569-08-14 (พ.ศ.)
    """
    
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="",
        database="conference_db"
    )
    cursor = conn.cursor()
    
    try:
        print("=" * 60)
        print("📊 MIGRATION: Year CE → BE (Add 543)")
        print("=" * 60)
        
        # 1. Check current data
        cursor.execute("SELECT COUNT(*) FROM conference_events WHERE date IS NOT NULL AND date != ''")
        total = cursor.fetchone()[0]
        print(f"\n📋 Total events with date: {total}")

        # 1b. กันรันซ้ำ: ถ้าปีเป็น พ.ศ. อยู่แล้ว (>= 2400) ห้ามบวก 543 ทับซ้ำอีก
        # ไม่งั้นข้อมูลจะเพี้ยนไปเป็นปี 3xxx (พ.ศ. + 543 อีกรอบ) แบบเงียบๆ ไม่มี error ให้เห็น
        cursor.execute("""
            SELECT COUNT(*) FROM conference_events
            WHERE date IS NOT NULL AND date != '' AND YEAR(date) >= 2400
        """)
        already_be = cursor.fetchone()[0]
        if already_be > 0:
            print(f"\n⏭️  พบ {already_be}/{total} แถวที่เป็น พ.ศ. อยู่แล้ว (ปี >= 2400) — ดูเหมือน migration นี้เคยรันไปแล้ว")
            print("❌ ยกเลิก migration เพื่อป้องกันบวก 543 ปีซ้ำซ้อน")
            return False

        # 2. Show sample BEFORE
        print("\n📋 BEFORE migration (sample 3 rows):")
        cursor.execute("""
            SELECT id, title, date FROM conference_events
            WHERE date IS NOT NULL AND date != ''
            LIMIT 3
        """)
        for row in cursor.fetchall():
            print(f"  ID {row[0]}: {row[1][:30]:30s} → {row[2]}")

        # 3. Confirm before proceeding
        response = input("\n⚠️  Are you sure? This will add 543 to all years. (yes/no): ")
        if response.lower() != "yes":
            print("❌ Migration cancelled")
            return False

        # 4. UPDATE: add 543 to year
        # date != '' กันไม่ให้ DATE_ADD('', INTERVAL 543 YEAR) คืนค่า NULL ทับแถวที่ยังไม่มีวันที่แบบเงียบๆ
        print("\n⏳ Migrating...")
        cursor.execute("""
            UPDATE conference_events
            SET date = DATE_ADD(date, INTERVAL 543 YEAR)
            WHERE date IS NOT NULL AND date != ''
        """)

        updated = cursor.rowcount
        print(f"✅ Updated {updated} rows")

        # 5. Show sample AFTER
        print("\n📋 AFTER migration (sample 3 rows):")
        cursor.execute("""
            SELECT id, title, date FROM conference_events
            WHERE date IS NOT NULL AND date != ''
            LIMIT 3
        """)
        for row in cursor.fetchall():
            print(f"  ID {row[0]}: {row[1][:30]:30s} → {row[2]}")
        
        # 6. Verify all years are >= 2500 (BE)
        cursor.execute("""
            SELECT COUNT(*) FROM conference_events
            WHERE date IS NOT NULL AND date != '' AND YEAR(date) >= 2500
        """)
        be_count = cursor.fetchone()[0]
        
        print(f"\n✅ Events with BE year (>= 2500): {be_count} / {total}")
        
        if be_count == total:
            print("✅ Verification passed! Committing...")
            conn.commit()
            print("✅ Migration successful!")
            return True
        else:
            print(f"❌ Verification failed! {total - be_count} rows still have CE years")
            conn.rollback()
            return False
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    success = migrate_year_to_be()
    exit(0 if success else 1)