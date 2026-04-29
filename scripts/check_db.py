import sqlite3

def check_db():
    conn = sqlite3.connect("backend/traffic_brain.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM learned_patterns")
    rows = cursor.fetchall()
    print(f"Found {len(rows)} patterns:")
    for row in rows:
        print(row)
    
    cursor.execute("SELECT COUNT(*) FROM user_journey_logs")
    logs_count = cursor.fetchone()[0]
    print(f"Total journey logs: {logs_count}")
    conn.close()

if __name__ == "__main__":
    check_db()
