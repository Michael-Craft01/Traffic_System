import sqlite3
import pandas as pd
import os
import sys

# Add backend to path to import models if needed, 
# although for simple export we can just use raw SQL.
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from core.config import settings
db_path = settings.DATABASE_URL.replace("sqlite:///", "")
output_csv = os.path.join(current_dir, "historical_traffic.csv")

def export_traffic_data():
    """
    Pulls data from SQL history and prepares it for the ML Training pipeline.
    """
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return False

    print(f"Exporting data from {db_path}...")
    
    conn = sqlite3.connect(db_path)
    # Query all traffic history
    query = "SELECT sensor_id, vehicle_count, congestion_status, timestamp FROM traffic_history ORDER BY timestamp ASC"
    df = pd.read_sql_query(query, conn)
    conn.close()

    if df.empty:
        print("Warning: No data found in traffic_history table.")
        return False

    # 1. Feature Engineering
    # Convert timestamp to datetime objects
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Extract temporal features
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    
    # For now, we simulate 'speed' since it's not in the DB yet 
    # (Stage 1 logic: speed is inversely proportional to volume)
    df['speed'] = 65 - (df['vehicle_count'].clip(upper=1000) / 20)
    
    # 2. Rename columns to match what data_loader.py expects
    df = df.rename(columns={'vehicle_count': 'volume'})
    
    # 3. Clean up and save
    # In a real system, we'd filter by sensor_id or handle multiple sensors.
    # For the MVP, we export the primary sensor's data.
    df = df[['timestamp', 'volume', 'speed', 'hour', 'day_of_week']]
    
    df.to_csv(output_csv, index=False)
    print(f"Successfully exported {len(df)} records to {output_csv}")
    return True

if __name__ == "__main__":
    if not export_traffic_data():
        sys.exit(1)
