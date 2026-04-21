from core.database import SessionLocal, TrafficHistory
from core.security import anonymize_id, get_current_user
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from core.logger import get_logger
from core.ml_integration import ml_brain
from core.recommendation import RecommendationEngine
import time

logger = get_logger("routing_api")

router = APIRouter()

class RouteRequest(BaseModel):
    user_id: str
    route_id: str
    departure_delay_mins: int  # e.g. 15 means they plan to leave in 15 mins

@router.post("/check-commute")
async def check_planned_commute(
    request: RouteRequest,
    current_user: str = Depends(get_current_user)
):
    """
    Endpoint for the PWA. 
    Secured by JWT. Anonymizes the user_id for privacy.
    """
    # 1. Anonymize user data for privacy (Stage 4 requirement)
    safe_user_id = anonymize_id(request.user_id)
    logger.info(f"Authorized request: User {safe_user_id} checking route {request.route_id}")

    # Convert minutes into our 5-minute index blocks
    departure_index = request.departure_delay_mins // 5
    
    # Anonymize user telemetry before processing (Stage 4 requirement)
    anon_user = anonymize_id(request.user_id)
    logger.info(f"Processing route request for anonymous user {anon_user} on route {request.route_id}...")
    
    recommendation = await run_in_threadpool(
        RecommendationEngine.calculate_optimal_departure,
        route_id=request.route_id, 
        planned_departure_index=departure_index
    )
    
    # Return anonymized metadata in response
    recommendation["anon_trace"] = safe_user_id
    
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
        
    from core.ml_integration import get_recent_history, ml_brain
    from core.security import anonymize_id
    
    recent_data = get_recent_history(route_id)
    
    # Run predictions in threadpool to prevent blocking FastAPI
    predictions = await run_in_threadpool(ml_brain.predict_future_traffic, recent_data)
    
    return {
        "route_id": route_id,
        "forecast_30_mins": predictions
    }
