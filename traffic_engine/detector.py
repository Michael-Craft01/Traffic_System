import cv2
import json
import os
from ultralytics import YOLO
import time

# --- CONFIGURATION (EDIT THIS) ---
# 1. Your Phone's IP (Find this in the IP Webcam app)
# Example: "192.168.2.178"
PHONE_IP = "192.168.2.178" 

# 2. Port (Default is 8080)
PORT = "8080"

# --- SYSTEM SETTINGS (DO NOT EDIT UNLESS NEEDED) ---
DATA_FILE = os.path.join(os.path.dirname(__file__), '../public/traffic_data.json')
FRAME_FILE = os.path.join(os.path.dirname(__file__), '../public/processed_frame.jpg')

# Use Environment variable if set, otherwise use the IP above
# To use computer webcam, set PHONE_IP to "0"
env_source = os.getenv("TRAFFIC_VIDEO_SOURCE")
if env_source:
    VIDEO_SOURCE = env_source
elif PHONE_IP == "0":
    VIDEO_SOURCE = 0
else:
    VIDEO_SOURCE = f"http://{PHONE_IP}:{PORT}/video"

if isinstance(VIDEO_SOURCE, str) and VIDEO_SOURCE.isdigit():
    VIDEO_SOURCE = int(VIDEO_SOURCE)

# Ensure directory exists
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

# Load YOLOv8 model (Nano version for speed)
print("Loading AI Model...")
model = YOLO('yolov8n.pt') 

def update_json(count, status):
    data = {
        "vehicle_count": count,
        "congestion_status": status,
        "last_updated": time.time()
    }
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f)
        # print(f"✅ Data Updated: {count} vehicles | Status: {status}") # Quieter logs
    except Exception as e:
        print(f"❌ JSON Error: {e}")

def determine_status(count):
    if count < 5: return "CLEAR"
    if count < 15: return "MODERATE"
    return "CONGESTED"

def start_detection():
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    if not cap.isOpened():
        print(f"❌ Error: Could not open video source {VIDEO_SOURCE}.")
        return False

    print(f"🚀 Traffic AI Engine Started on: {VIDEO_SOURCE}")
    print("   (Press 'q' to stop)")

    last_update_time = time.time()
    db_update_interval = 0.5 # Update JSON every 500ms
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️ Video stream lost. Retrying in 5 seconds...")
            cap.release()
            time.sleep(5)
            cap = cv2.VideoCapture(VIDEO_SOURCE)
            continue

        # Run YOLOv8 inference
        results = model(frame, stream=True, verbose=False)
        vehicle_count = 0 
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                name = model.names[cls]
                
                if name in ['car', 'bus', 'truck', 'motorcycle']:
                    vehicle_count += 1
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        status = determine_status(vehicle_count)
        
        # Visuals for local interface
        cv2.putText(frame, f"Vehicles: {vehicle_count}", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        cv2.putText(frame, f"Status: {status}", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
        cv2.imshow("Traffic AI Vision", frame)
        
        # Save frame for web dashboard (High-speed "live" feed)
        try:
            cv2.imwrite(FRAME_FILE, frame)
        except Exception as e:
            print(f"❌ Frame Save Error: {e}")

        # Update JSON for dashboard data
        current_time = time.time()
        if current_time - last_update_time >= db_update_interval:
             update_json(vehicle_count, status)
             last_update_time = current_time

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    return True

if __name__ == "__main__":
    while True:
        if not start_detection():
            print("Trying to restart in 10 seconds...")
            time.sleep(10)
        else:
            break
