import os
import requests
import time
from ultralytics import YOLO

# 1. Configuration (Prioritize environment variables set by the launcher)
PHONE_IP = os.environ.get("TRAFFIC_PHONE_IP", "192.168.1.128").strip()
PORT = os.environ.get("TRAFFIC_PHONE_PORT", "8080").strip()
BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000/api/v1/ingest/camera").strip()
CAMERA_ID = "cam_main_01"

if PHONE_IP != "0":
    VIDEO_SOURCE = f"http://{PHONE_IP}:{PORT}/video"
else:
    VIDEO_SOURCE = 0

print(f"🚀 Launching Native YOLOv8 Detector on: {VIDEO_SOURCE}")

# 2. Load the standard YOLOv8 model
model = YOLO('yolov8n.pt')

def determine_status(count):
    if count < 5: return "CLEAR"
    if count < 15: return "MODERATE"
    return "CONGESTED"

def send_to_backend(count, status):
    payload = {
        "camera_id": CAMERA_ID,
        "total_flow": count,
        "status": status,
        "latitude": -17.8292, # Example coords
        "longitude": 31.0522
    }
    try:
        requests.post(BACKEND_URL, json=payload, headers={"Authorization": "Bearer demo-token"}, timeout=1)
    except:
        pass

import cv2

# 3. Main Tracking Loop
# We use 'stream=True' for efficiency and manually render the window to add our custom HUD.
results_generator = model.track(
    source=VIDEO_SOURCE, 
    persist=True, 
    imgsz=320, 
    stream=True,
    classes=[2, 3, 5, 7]
)

print("🚀 Vision Engine Online. Press 'q' in the window to stop.")

for result in results_generator:
    # 1. Get the frame with native YOLO boxes already drawn
    frame = result.plot()
    
    # 2. Calculate Traffic Data
    count = len(result.boxes) if result.boxes.id is not None else 0
    status = determine_status(count)
    
    # 3. Overlay our custom "Traffic Details" HUD
    # We use a high-contrast style for professional look
    cv2.putText(frame, f"VEHICLES: {count}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    cv2.putText(frame, f"STATUS: {status}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    
    # 4. Show the combined frame
    cv2.imshow("Traffic AI Vision Node", frame)
    
    # Send data to backend
    send_to_backend(count, status)
    
    # Check for 'q' key to exit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()
