import os
import requests
import time
import threading
import cv2
from ultralytics import YOLO

# 1. Configuration
PHONE_IP = os.environ.get("TRAFFIC_PHONE_IP", "192.168.1.128").strip()
PORT = os.environ.get("TRAFFIC_PHONE_PORT", "8080").strip()
BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:8000/api/v1/ingest/camera").strip()
CAMERA_ID = "cam_main_01"

if PHONE_IP != "0":
    VIDEO_SOURCE = f"http://{PHONE_IP}:{PORT}/video"
else:
    VIDEO_SOURCE = 0

# 2. Threaded Frame Reader (The ROOT CAUSE fix for lag)
class RealTimeStream:
    def __init__(self, url):
        self.cap = cv2.VideoCapture(url)
        self.grabbed, self.frame = self.cap.read()
        self.running = True
        # Start background thread to keep the buffer empty
        threading.Thread(target=self.update, daemon=True).start()

    def update(self):
        while self.running:
            self.grabbed, self.frame = self.cap.read()
            if not self.grabbed:
                self.running = False

    def read(self):
        return self.frame

    def stop(self):
        self.running = False
        self.cap.release()

# 3. AI Setup
model = YOLO('yolov8n.pt')

def determine_status(count):
    if count < 5: return "CLEAR"
    if count < 15: return "MODERATE"
    return "CONGESTED"

def send_to_backend(count, status):
    payload = {"camera_id": CAMERA_ID, "total_flow": count, "status": status, "latitude": -17.8292, "longitude": 31.0522}
    try:
        requests.post(BACKEND_URL, json=payload, headers={"Authorization": "Bearer demo-token"}, timeout=0.1)
    except:
        pass

# 4. Main Real-Time Loop
stream = RealTimeStream(VIDEO_SOURCE)
print(f"🚀 Real-Time Vision Online: {VIDEO_SOURCE}")

while stream.running:
    frame = stream.read()
    if frame is None: continue

    # Run YOLOv8 on the LATEST frame only
    results = model.track(frame, persist=True, verbose=False, imgsz=320, classes=[2, 3, 5, 7])
    
    if results[0].boxes is not None:
        # Draw native YOLO boxes
        annotated_frame = results[0].plot()
        count = len(results[0].boxes)
        status = determine_status(count)
        
        # HUD Overlays
        cv2.putText(annotated_frame, f"CARS: {count} | STATUS: {status}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        
        cv2.imshow("Traffic AI Vision Node", annotated_frame)
        threading.Thread(target=send_to_backend, args=(count, status), daemon=True).start()

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

stream.stop()
cv2.destroyAllWindows()
