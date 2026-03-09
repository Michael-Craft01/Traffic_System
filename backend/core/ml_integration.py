import os
import sys

# Add the traffic_engine folder to the Python path so we can import the ML Brain
# This allows the backend to use the PyTorch code without duplicating it
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
ml_dir = os.path.join(root_dir, "traffic_engine", "ml")
if ml_dir not in sys.path:
    sys.path.append(ml_dir)

from core.logger import get_logger
from core.redis import redis_manager

logger = get_logger("ml_integration")

try:
    from inference import BrainInference
    
    # Initialize the ML Brain
    # Note: In production, this path needs to be robust. 
    model_path = os.path.join(ml_dir, "traffic_model_best.pth")
    metadata_path = os.path.join(ml_dir, "model_metadata.txt")
    
    ml_brain = BrainInference(model_path=model_path, metadata_path=metadata_path)
    logger.info("✅ Successfully loaded ML Brain into Backend Core")
    
except ImportError as e:
    logger.error(f"⚠️ Warning: Could not load ML Brain. Ensure traffic_engine/ml exists. Error: {e}")
    ml_brain = None
    
# Dynamic window builder for the presentation
def get_recent_history(route_id: str):
    """
    Builds a 60-minute historical sequence (12 blocks of 5-mins) for the ML model.
    Since we don't have a 60-minute database running yet, we simulate the past 55 minutes,
    and we inject the LIVE REDIS CAMERA DATA for the final 5 minutes!
    This guarantees the prediction curve instantly reacts to what the camera is seeing right now.
    """
    # 1. Check Redis for the absolutely live camera state
    states = redis_manager.get_all_camera_states()
    live_state = states.get(route_id, {})
    
    # The detector sends cumulative flow. We pretend this cumulative total 
    # represents the volume for the current 5-minute block for the demo.
    live_volume = live_state.get('total_flow', 350)
    
    # Speed is inversely proportional to volume (more cars = slower)
    live_speed = max(10, 65 - (live_volume / 20))
    
    # 2. Build the array (11 simulated past points + 1 live real point)
    # This guarantees the ML model operates on a full window, but the trajectory 
    # of the prediction is heavily weighted by the live camera reading at the end.
    base_window = [
        [300, 60], [320, 58], [350, 55], [380, 52],
        [400, 50], [420, 48], [450, 45], [480, 42],
        [500, 40], [520, 38], [550, 35]
    ]
    
    # Append the real, live data from the IP Webcam!
    base_window.append([live_volume, live_speed])
    
    return base_window
