import cv2
import json
import os
from ultralytics import YOLO
import time

# --- CONFIGURATION ---
DATA_FILE = os.path.join(os.path.dirname(__file__), '../app/public/traffic_data.json')

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
        print(f"✅ Data Updated: {count} vehicles | Status: {status}")
    except Exception as e:
        print(f"❌ File Error: {e}")

def determine_status(count):
    if count < 5: return "CLEAR"
    if count < 15: return "MODERATE"
    return "CONGESTED"

# Open Video Source (0 for Webcam)
video_source = 0 
cap = cv2.VideoCapture(video_source)

if not cap.isOpened():
    print(f"❌ Error: Could not open video source {video_source}.")
    print("   If using a webcam, ensure it is plugged in and allowed.")
    exit()

print(f"🚀 Traffic AI Engine Started on source: {video_source}")
print(f"📂 Writing data to: {os.path.abspath(DATA_FILE)}")
print("   (Press 'q' to stop)")

last_update_time = time.time()
db_update_interval = 1.0 # Update faster since file I/O is cheap

while True:
    ret, frame = cap.read()
    if not ret:
        print("⚠️ Video stream ended or camera disconnected.")
        break

    # Run YOLOv8 inference on the frame
    results = model(frame, stream=True, verbose=False)

    vehicle_count = 0 
    
    # Process results
    for r in results:
        boxes = r.boxes
        for box in boxes:
            # Class extracted
            cls = int(box.cls[0])
            name = model.names[cls]
            
            # Count only vehicles
            if name in ['car', 'bus', 'truck', 'motorcycle']:
                vehicle_count += 1
                
                # Draw bounding box
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, name, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    status = determine_status(vehicle_count)
    
    # Visuals on screen
    cv2.putText(frame, f"Vehicles: {vehicle_count}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
    cv2.putText(frame, f"Status: {status}", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 3)
    
    cv2.imshow("Traffic AI Vision", frame)
    
    # Update JSON non-blocking
    current_time = time.time()
    if current_time - last_update_time >= db_update_interval:
         update_json(vehicle_count, status)
         last_update_time = current_time

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
