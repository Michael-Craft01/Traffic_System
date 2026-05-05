from core.ml_integration import ml_brain, get_recent_history
from core.config import settings
from core.logger import get_logger
from core.redis import redis_manager

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
            
        if route_id.startswith("cam_virtual"):
            # Provide a location-agnostic forecast based purely on time of day
            import datetime
            now = datetime.datetime.now()
            from core.ml_integration import _synthetic_volume
            # Generate predictions for the next 30 mins
            predictions = [_synthetic_volume((now + datetime.timedelta(minutes=i*5)).hour, now.weekday()) for i in range(6)]
        else:
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
        
        # --- LOAD BALANCING LOGIC ---
        # 1 user assigned = 5 vehicles of impact
        virtual_load = redis_manager.get_route_load(route_id, planned_departure_index) * 5
        incident_penalty = redis_manager.get_incident_penalty(route_id)
        effective_volume = planned_volume + virtual_load + incident_penalty
        
        if effective_volume < threshold:
            redis_manager.increment_route_load(route_id, planned_departure_index)
            return {
                "status": "CLEAR",
                "message": "Your planned departure time looks clear.",
                "predicted_volume": planned_volume,
                "suggested_shift_mins": 0
            }
            
        # 4. Route IS congested (naturally or due to high app usage). Find closest alternative departure time.
        clear_windows = []
        for i, p_vol in enumerate(predictions):
            v_load = redis_manager.get_route_load(route_id, i) * 5
            if (p_vol + v_load + incident_penalty) < threshold:
                clear_windows.append(i)

        if clear_windows:
            import random
            # Find closest window to planned index
            closest_idx = sorted(clear_windows, key=lambda x: abs(x - planned_departure_index))[0]
            
            redis_manager.increment_route_load(route_id, closest_idx)
            
            shift_intervals = closest_idx - planned_departure_index
            shift_mins = shift_intervals * 5
            
            direction = "later" if shift_mins > 0 else "early"
            
            if planned_volume < threshold:
               msg = f"ROUTE LOAD BALANCING: High app user volume. Leave {abs(shift_mins)} mins {direction} to stagger departure."
               status = "WARNING"
               orch_mode = "Staggered"
            else:
               msg = f"HEAVY TRAFFIC PREDICTED. Leave {abs(shift_mins)} mins {direction} to save time."
               status = "ALERT"
               orch_mode = "Balanced"
               
            logger.info(f"Issuing severity {status} for route {route_id}. Shift: {shift_mins}m")
            return {
                "status": status,
                "message": msg,
                "predicted_volume": planned_volume,
                "suggested_shift_mins": shift_mins,
                "orchestration_mode": orch_mode
            }
                
        # If we get here, the entire 30 minute window is jammed
        is_incident = incident_penalty > 0
        return {
            "status": "ALERT" if is_incident else "WARNING",
            "message": "[USER REPORTED INCIDENT AHEAD] Severe block. Avoid route." if is_incident else "Heavy traffic for the entire 30-min window. Expect delays.",
            "predicted_volume": planned_volume,
            "suggested_shift_mins": 0
        }
