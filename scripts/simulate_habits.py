import requests
import time

BASE_URL = "http://localhost:8000/api/v1/telemetry"

def simulate_logs():
    payload = {
        "user_id": "local_user_01",
        "origin_name": "Borrowdale, Harare",
        "origin_lat": -17.750,
        "origin_lng": 31.100,
        "dest_name": "CBD, Harare",
        "dest_lat": -17.830,
        "dest_lng": 31.050
    }

    print("--- Simulating 3 Journey Logs ---")
    for i in range(3):
        try:
            res = requests.post(f"{BASE_URL}/log", json=payload)
            print(f"Log {i+1}: {res.status_code} - {res.json()}")
        except Exception as e:
            print(f"Failed to log journey: {e}")
        time.sleep(1)

if __name__ == "__main__":
    simulate_logs()
