from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from core.redis import redis_manager
from core.logger import get_logger
from core.database import SessionLocal, TrafficHistory
import time

logger = get_logger("ingestion_api")

router = APIRouter()

class CameraPayload(BaseModel):
    """
    Pydantic defines the strict structure of the JSON payload we expect 
    from detector.py. If the payload is wrong, FastAPI automatically returns a 422 error.
    """
    camera_id: str
    total_flow: int
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

def save_camera_data_bg(camera_id: str, data: dict):
    """Background task to handle the actual storage (to Redis and eventually SQL)"""
    # 1. Update Redis (Fast Cache)
    success = redis_manager.set_camera_state(camera_id, data)
    if not success:
        logger.error(f"Failed to save state for {camera_id} to Redis.")
    
    # 2. Update SQL (Historical Store)
    db = SessionLocal()
    try:
        new_log = TrafficHistory(
            sensor_id=camera_id,
            vehicle_count=data["total_flow"],
            congestion_status=data["status"]
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to save historical data for {camera_id} to SQL: {e}")
        db.rollback()
    finally:
        db.close()

@router.post("/camera")
async def ingest_camera_data(payload: CameraPayload, background_tasks: BackgroundTasks):
    """
    Endpoint for detector.py to POST live traffic data.
    This accepts the payload instantly and queues the storage work to the background.
    """
    data_to_store = payload.dict()
    data_to_store["server_time"] = time.time()
    
    # Add the saving work to FastAPI's background task queue immediately
    background_tasks.add_task(save_camera_data_bg, payload.camera_id, data_to_store)
    
    return {"status": "success", "message": f"Ingest queued for {payload.camera_id}"}
