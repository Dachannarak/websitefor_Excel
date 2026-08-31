from sqlalchemy import create_engine, text, inspect

db_url = "mysql+pymysql://root:@localhost:3306/conference_db"

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("✅ Connected to MySQL!")
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        print(f"\n📊 Tables ({len(tables)}):")
        total_rows = 0
        for table in tables:
            row_count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            total_rows += row_count
            print(f"   {table:20} : {row_count:6} rows")
        
        print(f"\n📈 Total: {total_rows} rows")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("   Make sure MySQL is running!")
