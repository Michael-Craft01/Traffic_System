from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.camera_service import camera_service
from core.security import get_current_user
from core.logger import get_logger

import asyncio
import time
from fastapi.responses import StreamingResponse
from fastapi import Request

logger = get_logger("camera_api")

router = APIRouter()

# Global buffer for the latest processed frame
_latest_frame = None

class ConnectPayload(BaseModel):
    ip: str
    port: str = "8080"
    camera_id: str = "cam_main_01"

@router.post("/connect")
async def connect_camera(payload: ConnectPayload, user: str = Depends(get_current_user)):
    """Connects a new physical camera node"""
    success = camera_service.start(payload.ip, payload.port, payload.camera_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to initialize camera node")
    return {"status": "success", "message": f"Connected to {payload.ip}:{payload.port}"}

@router.post("/disconnect")
async def disconnect_camera(user: str = Depends(get_current_user)):
    """Disconnects the active physical camera node"""
    success = camera_service.stop()
    return {"status": "success", "message": "Disconnected"}

@router.get("/status")
async def get_camera_status(user: str = Depends(get_current_user)):
    """Returns the current state of the live node"""
    return camera_service.get_status()

@router.post("/ingest-frame")
async def ingest_frame(request: Request):
    """Receives a binary JPEG frame from the detector"""
    global _latest_frame
    _latest_frame = await request.body()
    return {"status": "ok"}

@router.get("/stream")
async def stream_camera():
    """Serves an MJPEG stream of the latest processed frames"""
    async def frame_generator():
        while True:
            if _latest_frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + _latest_frame + b'\r\n')
            await asyncio.sleep(0.05) # ~20 FPS limit
            
    return StreamingResponse(
        frame_generator(), 
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
