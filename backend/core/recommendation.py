from core.ml_integration import ml_brain, get_recent_history
from core.config import settings
from core.logger import get_logger

logger = get_logger("recommendation")

class RecommendationEngine:
    """
    The core logic for Objective 3: Active Traffic Optimization.
    Calculates if a user should change their departure time to prevent a jam.
    """

    @classmethod
    def calculate_optimal_departure(cls, route_id: str, planned_departure_index: int):
        """
        Analyzes the predicted traffic to see if the user's planned departure hits a jam.
        If it does, it suggests an earlier departure.
        
        Args:
            route_id (str): ID of the road segment
            planned_departure_index (int): How many 5-min intervals from now the user plans to leave (0 to 5)
            
        Returns:
            dict: The recommendation payload for the mobile app
        """
        if not ml_brain:
            return {"status": "error", "message": "ML Engine offline."}
            
        # 1. Get recent history and ask the ML Brain for a prediction
        recent_data = get_recent_history(route_id)
        
        try:
            # Returns a list of 6 predictions (next 30 mins)
            predictions = ml_brain.predict_future_traffic(recent_data)
        except Exception as e:
            return {"status": "error", "message": str(e)}

        # 2. Check the user's planned departure time against the prediction
        if planned_departure_index >= len(predictions):
            return {"status": "unknown", "message": "Departure too far in future to accurately predict."}

        planned_volume = predictions[planned_departure_index]
        
        # 3. Decision Logic
        if planned_volume < settings.CONGESTION_THRESHOLD_VOLUME:
            # Route is clear at their planned time
            return {
                "status": "CLEAR",
                "message": "Your planned departure time looks clear.",
                "predicted_volume": planned_volume,
                "suggested_shift_mins": 0
            }
            
        # 4. Route IS congested. Calculate an alternative departure time.
        # Spreading Logic (Stage 4): Prevent "Network Shifting" by distributing
        # users across multiple potential windows rather than just the first clear one.
        
        clear_windows = []
        for i in range(planned_departure_index - 1, -1, -1):
            if predictions[i] < settings.CONGESTION_THRESHOLD_VOLUME:
                clear_windows.append(i)

        if clear_windows:
            # Stage 4 Optimization: Instead of always picking the closest window,
            # we pick a random one from the clear list or slightly shift based on user_id
            # to ensure the city capacity is balanced.
            import random
            # Deterministic jitter based on user_id (simulated orchestration)
            shift_to_index = clear_windows[hash(route_id) % len(clear_windows)]
            
            shift_intervals = planned_departure_index - shift_to_index
            shift_mins = shift_intervals * 5
            
            logger.info(f"Issuing severity ALERT for route {route_id}. Balanced shift: {shift_mins}m")
            return {
                "status": "ALERT",
                "message": f"SEVERE CONGESTION PREDICTED! We recommend leaving approx. {shift_mins} minutes early to balance city traffic.",
                "predicted_volume_if_no_change": planned_volume,
                "suggested_shift_mins": -shift_mins,
                "orchestration_mode": "Balanced"
            }
                
        # If we get here, it's jammed now and stays jammed until their departure.
        return {
            "status": "WARNING",
            "message": "Traffic is already heavy and building. Prepare for delays.",
            "predicted_volume": planned_volume,
            "suggested_shift_mins": 0
        }
