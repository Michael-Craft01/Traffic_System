from core.ml_integration import ml_brain, get_recent_history
from core.config import settings
from core.logger import get_logger

logger = get_logger("recommendation")

class RecommendationEngine:
    """
    The core logic for Active Traffic Optimization.
    Calculates if a user should change their departure time to prevent a jam.
    """

    @classmethod
    def calculate_optimal_departure(cls, route_id: str, planned_departure_index: int):
        if not ml_brain:
            return {"status": "error", "message": "ML Engine offline."}
            
        recent_data = get_recent_history(route_id)
        
        try:
            predictions = ml_brain.predict_future_traffic(recent_data)
        except Exception as e:
            return {"status": "error", "message": str(e)}

        if planned_departure_index >= len(predictions):
            return {
                "status": "error", 
                "message": f"Cannot predict that far ahead. Max is +{ (len(predictions) - 1) * 5 } mins.",
                "predicted_volume": 0
            }

        planned_volume = predictions[planned_departure_index]
        threshold = settings.CONGESTION_THRESHOLD_VOLUME
        
        if planned_volume < threshold:
            return {
                "status": "CLEAR",
                "message": "Your planned departure time looks clear.",
                "predicted_volume": planned_volume,
                "suggested_shift_mins": 0
            }
            
        # 4. Route IS congested. Find closest alternative departure time (earlier OR later).
        clear_windows = []
        for i, p_vol in enumerate(predictions):
            if p_vol < threshold:
                clear_windows.append(i)

        if clear_windows:
            import random
            # Find closest window to planned index
            closest_idx = sorted(clear_windows, key=lambda x: abs(x - planned_departure_index))[0]
            
            shift_intervals = closest_idx - planned_departure_index
            shift_mins = shift_intervals * 5
            
            direction = "later" if shift_mins > 0 else "early"
            
            logger.info(f"Issuing severity ALERT for route {route_id}. Shift: {shift_mins}m")
            return {
                "status": "ALERT",
                "message": f"HEAVY TRAFFIC PREDICTED. Leave {abs(shift_mins)} mins {direction} to save time.",
                "predicted_volume": planned_volume,
                "suggested_shift_mins": shift_mins,
                "orchestration_mode": "Balanced"
            }
                
        # If we get here, the entire 30 minute window is jammed
        return {
            "status": "WARNING",
            "message": "Heavy traffic for the entire 30-min window. Expect delays.",
            "predicted_volume": planned_volume,
            "suggested_shift_mins": 0
        }
