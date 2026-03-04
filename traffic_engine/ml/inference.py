import torch
import os
import random
from model import TrafficPredictorLSTM

class BrainInference:
    """
    Loads the trained PyTorch model and provides a simple interface 
    for the backend to request live traffic predictions.
    """
    def __init__(self, model_path="traffic_model_best.pth", metadata_path="model_metadata.txt", seq_length=12, pred_length=6):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.seq_length = seq_length
        self.pred_length = pred_length
        
        # Read the normalization factor saved during training
        try:
            with open(metadata_path, "r") as f:
                self.max_vol = float(f.read().strip())
            print(f"Loaded max volume scalar: {self.max_vol}")
        except FileNotFoundError:
            print("Warning: metadata not found, defaulting max_vol to 1000")
            self.max_vol = 1000.0
            
        # Initialize and load model
        self.model = TrafficPredictorLSTM(input_size=2, hidden_size=64, num_layers=2, output_size=pred_length)
        
        if os.path.exists(model_path):
            self.model.load_state_dict(torch.load(model_path, map_location=self.device, weights_only=True))
            print(f"Successfully loaded model weights from {model_path}")
        else:
            print(f"Warning: {model_path} not found. Running with untrained randomized weights (for testing only).")
            
        self.model.to(self.device)
        self.model.eval() # Must be in eval mode for inference
        
    def predict_future_traffic(self, recent_data):
        """
        Takes the last hour of traffic data and returns predictions for the next 30 mins.
        
        Args:
            recent_data (list of lists): The last `seq_length` periods of data.
                Format: [[volume_1, speed_1], [volume_2, speed_2], ... ]
                
        Returns:
            list: Predicted volumes for the next `pred_length` (e.g. 6) time slots.
        """
        if len(recent_data) != self.seq_length:
            raise ValueError(f"Expected sequence of exactly {self.seq_length} time slots.")
            
        # 1. Preprocess / Normalize the data exactly as done in data_loader
        # We assume speed max is around 75mph based on synthetic data generator
        normalized_input = []
        for vol, spd in recent_data:
            normalized_input.append([vol / self.max_vol, spd / 75.0])
            
        # 2. Convert to Tensor and add Batch Dimension
        # Shape goes from (12, 2) -> (1, 12, 2)
        input_tensor = torch.tensor(normalized_input, dtype=torch.float32).unsqueeze(0).to(self.device)
        
        # 3. Model Inference
        with torch.no_grad():
            prediction_tensor = self.model(input_tensor)
            
        # 4. Post-process / De-normalize
        # Shape of prediction_tensor is (1, 6). We want a simple list.
        prediction_normalized = prediction_tensor.squeeze(0).cpu().numpy().tolist()
        
        # Multiply by max_vol to get raw car counts back
        predicted_volumes = [int(max(0, val * self.max_vol)) for val in prediction_normalized]
        
        return predicted_volumes

# Simulating an API request
if __name__ == "__main__":
    inference_engine = BrainInference()
    
    print("\n--- Simulating Live Inference Request ---")
    # Simulate a sudden spike in traffic (volume rising, speed falling)
    # 12 steps = 60 minutes
    simulated_live_data = [
        [300, 60], [320, 58], [350, 55], [400, 50],
        [450, 45], [520, 40], [600, 35], [700, 25],
        [750, 20], [800, 15], [820, 12], [850, 10]
    ]
    
    print("Current State: Severe congestion building. (Speed dropped from 60 to 10mph)")
    
    try:
        predictions = inference_engine.predict_future_traffic(simulated_live_data)
        
        print("\nPredicted Traffic Volumes for next 30 mins (in 5 min intervals):")
        for i, vol in enumerate(predictions):
            print(f"  T+{5 * (i+1)} mins : {vol} cars")
            
    except Exception as e:
        print(f"Inference error: {e}")
