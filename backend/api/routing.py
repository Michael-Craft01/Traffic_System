from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from core.recommendation import RecommendationEngine
from core.ml_integration import get_recent_history, ml_brain
from core.logger import get_logger

logger = get_logger("routing_api")

router = APIRouter()

class RouteRequest(BaseModel):
    user_id: str
    route_id: str
    departure_delay_mins: int  # e.g. 15 means they plan to leave in 15 mins

@router.post("/check-commute")
async def check_planned_commute(request: RouteRequest):
    """
    Endpoint for the Flutter app. 
    The app asks: "I plan to leave in X minutes. Is that a bad idea?"
    """
    # Convert minutes into our 5-minute index blocks (e.g. 15 mins = index 3)
    departure_index = request.departure_delay_mins // 5
    
    # Decouple the heavy ML PyTorch processing from the main async loop!
    # This prevents one large calculation from pausing the entire API server.
    logger.info(f"Processing route request for {request.route_id} in background threadpool...")
    recommendation = await run_in_threadpool(
        RecommendationEngine.calculate_optimal_departure,
        route_id=request.route_id, 
        planned_departure_index=departure_index
    )
    
    return recommendation

@router.get("/forecast/{route_id}")
async def get_raw_forecast(route_id: str):
    """
    Gets the raw 30-minute prediction array for a specific route.
    Used for drawing the graphs/charts in the Flutter app.
    """
    if not ml_brain:
        logger.warning(f"Raw forecast requested for {route_id} but ML model is offline.")
        return {"error": "ML model not loaded"}
        
    recent_data = get_recent_history(route_id)
    
    # Run predictions in threadpool to prevent blocking FastAPI
    predictions = await run_in_threadpool(ml_brain.predict_future_traffic, recent_data)
    
    return {
        "route_id": route_id,
        "forecast_30_mins": predictions
    }
