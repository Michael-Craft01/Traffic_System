from core.ml_integration import ml_brain, get_recent_history

class RecommendationEngine:
    """
    The core logic for Objective 3: Active Traffic Optimization.
    Calculates if a user should change their departure time to prevent a jam.
    """
    
    # The maximum number of cars a road can handle before we consider it "congested"
    # This would normally be dynamic per road. Let's assume a hard cap for the demo.
    CONGESTION_THRESHOLD_VOLUME = 600

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
        if planned_volume < cls.CONGESTION_THRESHOLD_VOLUME:
            # Route is clear at their planned time
            return {
                "status": "CLEAR",
                "message": "Your planned departure time looks clear.",
                "predicted_volume": planned_volume,
                "suggested_shift_mins": 0
            }
            
        # 4. Route IS congested. Calculate an alternative departure time.
        # We look backwards from their planned time to find a clear window.
        # Example: if they plan to leave at index 3 (T+15), we check index 2 (T+10), index 1 (T+5), index 0 (Now)
        
        for i in range(planned_departure_index - 1, -1, -1):
            if predictions[i] < cls.CONGESTION_THRESHOLD_VOLUME:
                # We found a clear time slot earlier!
                shift_intervals = planned_departure_index - i
                shift_mins = shift_intervals * 5
                
                return {
                    "status": "ALERT",
                    "message": f"SEVERE CONGESTION PREDICTED! Leave {shift_mins} minutes early to avoid a massive jam.",
                    "predicted_volume_if_no_change": planned_volume,
                    "suggested_shift_mins": -shift_mins
                }
                
        # If we get here, it's jammed now and stays jammed until their departure.
        return {
            "status": "WARNING",
            "message": "Traffic is already heavy and building. Prepare for delays.",
            "predicted_volume": planned_volume,
            "suggested_shift_mins": 0
        }
