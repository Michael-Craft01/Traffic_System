import os
import requests
import time
from ultralytics import YOLO

# 1. Hardcoded Configuration
PHONE_IP = "192.168.1.128"
PORT = "8080"
BACKEND_URL = "http://127.0.0.1:8000/api/v1/ingest/camera"
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

# 3. Main Tracking Loop (Using native YOLO 'show=True')
# This is the simplest way to run YOLOv8 with a popup window.
results_generator = model.track(
    source=VIDEO_SOURCE, 
    show=True, 
    persist=True, 
    imgsz=320, 
    stream=True,
    classes=[2, 3, 5, 7] # car, motorcycle, bus, truck
)

print("Tracking started. Press 'q' in the popup window to stop.")

# Iterate through the results to send data to the backend
for result in results_generator:
    # Count detections in the current frame
    if result.boxes.id is not None:
        count = len(result.boxes.id)
    else:
        count = 0
    
    status = determine_status(count)
    send_to_backend(count, status)
