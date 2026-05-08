import os
import requests
import time
import threading
import cv2
import sys
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

# 2. Robust Threaded Stream (With Auto-Reconnect)
class RealTimeStream:
    def __init__(self, url):
        self.url = url
        self.connect()

    def connect(self):
        print(f"📡 Connecting to: {self.url}...")
        self.cap = cv2.VideoCapture(self.url)
        self.running = self.cap.isOpened()
        if not self.running:
            print("⚠️ Connection failed. Will retry in background...")
        
        self.grabbed, self.frame = self.cap.read()
        threading.Thread(target=self.update, daemon=True).start()

    def update(self):
        while True:
            if not self.running:
                time.sleep(2)
                self.cap = cv2.VideoCapture(self.url)
                self.running = self.cap.isOpened()
                continue
                
            self.grabbed, self.frame = self.cap.read()
            if not self.grabbed:
                print("❌ Stream lost. Reconnecting...")
                self.running = False

    def read(self):
        return self.frame if self.grabbed else None

    def stop(self):
        self.running = False
        self.cap.release()

# 3. AI & Logic Setup
print("🧠 Initializing AI Core...")
model = YOLO('yolov8n.pt')
seen_ids = set()
total_flow = 0

def determine_status(count):
    if count <= 2: return "CLEAR", (0, 255, 0)      # Green
    if count <= 5: return "MODERATE", (0, 255, 255) # Yellow
    return "CONGESTED", (0, 0, 255)                 # Red

def send_to_backend(count, status):
    payload = {"camera_id": CAMERA_ID, "total_flow": count, "status": status, "latitude": -17.8292, "longitude": 31.0522}
    try:
        requests.post(BACKEND_URL, json=payload, headers={"Authorization": "Bearer demo-token"}, timeout=0.1)
    except:
        pass

# 4. Main Execution Loop
try:
    stream = RealTimeStream(VIDEO_SOURCE)
    print("🚀 AI Node Active. Press 'q' to quit.")

    while True:
        frame = stream.read()
        if frame is None:
            time.sleep(0.1)
            continue

        h, w, _ = frame.shape
        line_y = h // 2  # The Tripwire in the middle

        # Run tracking
        results = model.track(frame, persist=True, verbose=False, imgsz=320, classes=[2, 3, 5, 7])
        
        if results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.int().cpu().numpy()
            
            for box, id in zip(boxes, ids):
                x1, y1, x2, y2 = map(int, box)
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                
                # Check Tripwire crossing
                if id not in seen_ids:
                    # If center point is near the tripwire, count it
                    if abs(cy - line_y) < 20:
                        seen_ids.add(id)
                        total_flow = len(seen_ids)

                # Draw bounding box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.circle(frame, (cx, cy), 4, (0, 0, 255), -1)

        # Calculate Congestion
        current_count = len(results[0].boxes) if results[0].boxes is not None else 0
        status_text, status_color = determine_status(current_count)

        # --- Visual HUD ---
        # Tripwire Line
        cv2.line(frame, (0, line_y), (w, line_y), (255, 255, 0), 2)
        cv2.putText(frame, "TRIPWIRE", (10, line_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Status Overlay (Large & Bold)
        cv2.rectangle(frame, (0, 0), (w, 60), (0, 0, 0), -1)
        cv2.putText(frame, f"STATUS: {status_text}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, status_color, 3)
        cv2.putText(frame, f"FLOW: {total_flow}", (w - 200, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

        cv2.imshow("Traffic AI Command Center", frame)
        threading.Thread(target=send_to_backend, args=(total_flow, status_text), daemon=True).start()

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'stream' in locals(): stream.stop()
    cv2.destroyAllWindows()
