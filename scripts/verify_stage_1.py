import requests
import time

BACKEND_URL = "http://localhost:8000/api/v1"
CAMERA_ID = "cam_main_01"

def simulate_ingestion():
    print(f"Simulating 15 data points for {CAMERA_ID}...")
    for i in range(15):
        payload = {
            "camera_id": CAMERA_ID,
            "total_flow": 300 + (i * 10),
            "status": "CLEAR" if i < 10 else "MODERATE",
            "latitude": 40.7128,
            "longitude": -74.0060
        }
        try:
            res = requests.post(f"{BACKEND_URL}/ingest/camera", json=payload)
            print(f"  [{i+1}/15] Ingested: {payload['total_flow']} cars - Status: {res.status_code}")
        except Exception as e:
            print(f"  [X] Failed: {e}")
        time.sleep(0.1)

def check_routing():
    print(f"\nChecking routing recommendations for {CAMERA_ID}...")
    payload = {
        "user_id": "user_test_01",
        "route_id": CAMERA_ID,
        "departure_delay_mins": 0
    }
    try:
        res = requests.post(f"{BACKEND_URL}/routing/check-commute", json=payload)
        data = res.json()
        print(f"  Response: {data['status']} - {data['message']}")
    except Exception as e:
        print(f"  [X] Failed: {e}")

if __name__ == "__main__":
    # Note: Backend must be running for this to work
    simulate_ingestion()
    time.sleep(1)
    check_routing()
