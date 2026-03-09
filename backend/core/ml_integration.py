import os
import sys

# Add the traffic_engine folder to the Python path so we can import the ML Brain
# This allows the backend to use the PyTorch code without duplicating it
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
ml_dir = os.path.join(root_dir, "traffic_engine", "ml")
if ml_dir not in sys.path:
    sys.path.append(ml_dir)

from core.database import SessionLocal, TrafficHistory
from core.redis import redis_manager
from core.logger import get_logger
from sqlalchemy import desc

logger = get_logger("ml_integration")

try:
    from inference import BrainInference
    
    # Initialize the ML Brain
    model_path = os.path.join(ml_dir, "traffic_model_best.pth")
    metadata_path = os.path.join(ml_dir, "model_metadata.txt")
    
    ml_brain = BrainInference(model_path=model_path, metadata_path=metadata_path)
    logger.info("Successfully loaded ML Brain into Backend Core")
    
except ImportError as e:
    logger.error(f"Warning: Could not load ML Brain. Ensure traffic_engine/ml exists. Error: {e}")
    ml_brain = None
    
# Dynamic window builder for the presentation
def get_recent_history(route_id: str):
    """
    Builds a 60-minute historical sequence (12 blocks of 5-mins) for the ML model.
    Pulls real data from SQL for the last 55 minutes, and merges with LIVE REDIS.
    """
    db = SessionLocal()
    try:
        # 1. Fetch the last 11 actual historical records from SQL
        # In a real system, we'd resample these into exactly 5-min buckets.
        # For this stage, we take the most recent 11 per sensor.
        history = db.query(TrafficHistory)\
            .filter(TrafficHistory.sensor_id == route_id)\
            .order_by(desc(TrafficHistory.timestamp))\
            .limit(11)\
            .all()
        
        # Reverse because we want oldest first
        history.reverse()
        
        base_window = []
        for log in history:
            # Reconstruct speed (simulated for now since detector only sends count)
            speed = max(10, 65 - (log.vehicle_count / 20))
            base_window.append([log.vehicle_count, speed])
            
        # 2. Fill gaps if we don't have enough history yet (cold start)
        while len(base_window) < 11:
            base_window.insert(0, [300, 60]) # Placeholder for cold start
            
    finally:
        db.close()

    # 3. Check Redis for the absolutely live camera state
    states = redis_manager.get_all_camera_states()
    live_state = states.get(route_id, {})
    live_volume = live_state.get('total_flow', 350)
    live_speed = max(10, 65 - (live_volume / 20))
    
    # Append the real, live data from the IP Webcam!
    base_window.append([live_volume, live_speed])
    
    return base_window
