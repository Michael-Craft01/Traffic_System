import sqlite3
import os

db_path = "c:/Users/ragum/Traffic_System/traffic_brain.db"

if not os.path.exists(db_path):
    print(f"Error: Database file not found at {db_path}")
    # Also check current directory
    db_path = "test.db"
    if not os.path.exists(db_path):
        print("Error: Database file not found in current directory either.")
        # Let's list files to find it
        print("Files in current directory:", os.listdir("."))

if os.path.exists(db_path):
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"--- Querying {db_path} ---")
        
        # Check sensors
        cursor.execute("SELECT * FROM sensors")
        sensors = cursor.fetchall()
        print(f"\nSensors ({len(sensors)}):")
        for s in sensors:
            print(f"  {s}")
            
        # Check traffic history
        cursor.execute("SELECT * FROM traffic_history ORDER BY timestamp DESC LIMIT 5")
        history = cursor.fetchall()
        print(f"\nTop 5 Traffic History Records:")
        for h in history:
            print(f"  {h}")
            
        cursor.execute("SELECT COUNT(*) FROM traffic_history")
        count = cursor.fetchone()[0]
        print(f"\nTotal records in traffic_history: {count}")
        
        conn.close()
    except Exception as e:
        print(f"Error querying database: {e}")
