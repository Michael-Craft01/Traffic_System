import cv2
import json
import os
import requests
from ultralytics import YOLO
import time
import threading

import argparse

# --- ARGUMENT PARSING ---
parser = argparse.ArgumentParser(description="Traffic AI Detector Node")
parser.add_argument("--ip", type=str, default="0", help="IP address of the phone camera (use '0' for webcam)")
parser.add_argument("--port", type=str, default="8080", help="Port of the IP camera app")
parser.add_argument("--camera_id", type=str, default="cam_main_01", help="ID of this node")
parser.add_argument("--url", type=str, default="http://127.0.0.1:8000/api/v1/ingest/camera", help="Backend ingestion URL")
args = parser.parse_args()

PHONE_IP = args.ip
PORT = args.port
BACKEND_URL = args.url
CAMERA_ID = args.camera_id

# --- SYSTEM SETTINGS ---
DATA_FILE = os.path.join(os.path.dirname(__file__), '../public/traffic_data.json')
FRAME_FILE = os.path.join(os.path.dirname(__file__), '../public/processed_frame.jpg')

if PHONE_IP and PHONE_IP != "0":
    VIDEO_SOURCE = f"http://{PHONE_IP}:{PORT}/video"
elif PHONE_IP == "0":
    VIDEO_SOURCE = 0
else:
    VIDEO_SOURCE = 0

print(f"📡 AI Node: {CAMERA_ID} | Source: {VIDEO_SOURCE}")

# Ensure directory exists
os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)

# Load YOLOv8 model (Nano version for speed)
print("Loading AI Model...")
model = YOLO('yolov8n.pt') 

def send_data_to_backend(count, status):
    """Sends the live data to the FastAPI backend ingestion endpoint"""
    payload = {
        "camera_id": CAMERA_ID,
        "total_flow": count,
        "status": status,
        "latitude": 40.7128, # Example coordinates
        "longitude": -74.0060
    }
    
    # We use the demo-token defined in security.py for local development
    headers = {
        "Authorization": "Bearer demo-token"
    }
    
    try:
        # We use a quick timeout so the video feed doesn't lag if the server is slow
        response = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=0.5)
        
        if response.status_code == 200:
            # Uncomment for verbose logging: print(f"✅ API Success: {response.status_code}")
            pass
        else:
            print(f"⚠️ Backend rejected data: {response.status_code} - {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend API Error: {e}")

def update_json(count, status):
    """(Legacy) Also saves to local JSON for simple dashboards"""
    data = {
        "vehicle_count": count,
        "congestion_status": status,
        "last_updated": time.time()
    }
    try:
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f)
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

    # --- TRACKING & COUNTING SETUP ---
    # Set to keep track of unique vehicle IDs seen in this session
    seen_ids = set()
    
    # Total count of vehicles that have crossed the line
    total_vehicles_passed = 0
    
    last_update_time = time.time()
    db_update_interval = 0.5 # Update JSON every 500ms
    
    # Track frames to allow for frame-skipping optimization
    frame_counter = 0
    
    # Enable YOLOv8 half-precision for a massive 2x speed boost on most GPUs
    # We also reduce the default Image Size from 640 to 320 to run 4x faster on CPU/weak GPUs
    # while maintaining enough accuracy for large cars.
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print(f"[WARN] Connection to {VIDEO_SOURCE} failed.")
            print(">>> NETWORK CHECKLIST:")
            print("1. Is the 'IP Webcam' app started on your phone?")
            print("2. Are BOTH phone and PC on the same Wi-Fi?")
            print("3. Try a Mobile Hotspot if your current Wi-Fi blocks devices.")
            print("Retrying in 5 seconds...")
            cap.release()
            time.sleep(5)
            cap = cv2.VideoCapture(VIDEO_SOURCE)
            continue
            
        # 1. OPTIMIZATION: Frame Skipping
        # IP Webcams usually output 30fps. YOLOv8 Nano on CPU might only do 10fps.
        # This causes the buffer to fill up and the video delays by several seconds.
        # Solution: Only process every 3rd frame to keep the feed "live".
        frame_counter += 1
        if frame_counter % 3 != 0:
            continue # Skip rendering this frame to let python catch up

        # 2. OPTIMIZATION: Reduce Image Size (imgsz=320)
        # This makes the detection grid 4x smaller, hugely increasing FPS!
        results = model.track(frame, persist=True, verbose=False, imgsz=320, classes=[2, 3, 5, 7]) 
        
        # Visual tracking processing

        current_frame_vehicles = 0
        
        # Check if any tracks were returned
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            clss = results[0].boxes.cls.int().cpu().tolist()

            for box, track_id, cls in zip(boxes, track_ids, clss):
                current_frame_vehicles += 1
                name = model.names[cls]
                
                # Bounding box coordinates
                x1, y1, x2, y2 = map(int, box)
                
                # Calculate center point of the bottom edge of the bounding box
                # (where the tires touch the road is usually best for triggering the line)
                center_x = int((x1 + x2) / 2)
                center_y = int(y2)
                
                # Draw the bounding box and the tracking ID
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.circle(frame, (center_x, center_y), 5, (255, 0, 0), -1)
                cv2.putText(frame, f"{name} #{track_id}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # --- UNIQUE VEHICLE COUNTING ---
                if track_id not in seen_ids:
                    seen_ids.add(track_id)
                    total_vehicles_passed = len(seen_ids)
                    print(f"[OK] New Vehicle Detected! Total Flow: {total_vehicles_passed}")

        # We base current status roughly on how many cars are on screen right now, 
        # but the JSON payload will pass the cumulative volume
        status = determine_status(current_frame_vehicles)
        
        # Visuals for local interface
        cv2.putText(frame, f"Active Vehicles: {current_frame_vehicles}", (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.putText(frame, f"Total Passed: {total_vehicles_passed}", (30, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)
        cv2.putText(frame, f"Status: {status}", (30, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
        
        cv2.imshow("Traffic AI Vision Node", frame)
        
        # REQUIRED for the window to actually show and refresh
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        
        # Save frame for web dashboard (High-speed "live" feed)
        try:
            cv2.imwrite(FRAME_FILE, frame)
        except Exception as e:
            print(f"❌ Frame Save Error: {e}")

        # Update JSON and send to backend
        current_time = time.time()
        if current_time - last_update_time >= db_update_interval:
            # Update local JSON
            update_json(total_vehicles_passed, status)
            
            # Fire and forget backend API call on a separate thread so video doesn't stutter
            threading.Thread(target=send_data_to_backend, args=(total_vehicles_passed, status)).start()
            
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
