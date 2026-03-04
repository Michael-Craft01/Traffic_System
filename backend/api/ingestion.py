from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.redis import redis_manager
import time

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

@router.post("/camera")
async def ingest_camera_data(payload: CameraPayload):
    """
    Endpoint for detector.py to POST live traffic data.
    This data goes straight into our high-speed Redis RAM cache.
    """
    # Add a server-side timestamp
    data_to_store = payload.dict()
    data_to_store["server_time"] = time.time()
    
    # Save to Redis
    success = redis_manager.set_camera_state(payload.camera_id, data_to_store)
    
    if not success:
        # We don't fail the request, but we log the issue
        print(f"Warning: Failed to save {payload.camera_id} state to Redis")
        
    return {"status": "success", "message": f"Ingested data for {payload.camera_id}"}
