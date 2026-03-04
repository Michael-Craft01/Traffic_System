from fastapi import APIRouter
from core.redis import redis_manager

router = APIRouter()

@router.get("/state")
async def get_live_traffic_state():
    """
    Endpoint for the millions of Flutter mobile apps to GET the current map state.
    Because this simply reads from Redis, it can handle immense scale.
    """
    # Fetch all active camera data from the fast RAM cache
    live_data = redis_manager.get_all_camera_states()
    
    # In the future, we will also merge the ML Predictions here
    # predictions = ml_brain.get_predictions(...)
    
    return {
        "status": "success",
        "live_nodes": len(live_data),
        "data": live_data,
        "predictions": "Coming soon"
    }
