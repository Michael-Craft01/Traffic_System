import os
import sys

# Add the traffic_engine folder to the Python path so we can import the ML Brain
# This allows the backend to use the PyTorch code without duplicating it
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(os.path.dirname(current_dir))
ml_dir = os.path.join(root_dir, "traffic_engine", "ml")
if ml_dir not in sys.path:
    sys.path.append(ml_dir)

try:
    from inference import BrainInference
    
    # Initialize the ML Brain
    # Note: In production, this path needs to be robust. 
    model_path = os.path.join(ml_dir, "traffic_model_best.pth")
    metadata_path = os.path.join(ml_dir, "model_metadata.txt")
    
    ml_brain = BrainInference(model_path=model_path, metadata_path=metadata_path)
    print("✅ Successfully loaded ML Brain into Backend Core")
    
except ImportError as e:
    print(f"⚠️ Warning: Could not load ML Brain. Ensure traffic_engine/ml exists. Error: {e}")
    ml_brain = None
    
# Mock historical data until we have real database history implemented
def get_recent_history(route_id: str):
    """
    Mock function simulating a database fetch for the last 60 minutes of data.
    """
    # Simulate rising traffic building up to a jam
    return [
        [300, 60], [320, 58], [350, 55], [400, 50],
        [450, 45], [520, 40], [600, 35], [700, 25],
        [750, 20], [800, 15], [820, 12], [850, 10]
    ]
