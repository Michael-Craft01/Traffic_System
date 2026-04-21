from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db, UserJourneyLog, LearnedPattern
from core.habit_discovery import HabitDiscoveryService
from core.security import anonymize_id
from core.logger import get_logger
from typing import List

logger = get_logger("telemetry_api")
router = APIRouter()

class JourneyLogRequest(BaseModel):
    user_id: str
    origin_name: str
    origin_lat: float
    origin_lng: float
    dest_name: str
    dest_lat: float
    dest_lng: float

class PatternResponse(BaseModel):
    id: int
    label: str
    origin_name: str
    dest_name: str
    target_time: str
    confidence: float

@router.post("/log")
async def log_journey(req: JourneyLogRequest, db: Session = Depends(get_db)):
    """
    Records a journey for future pattern discovery.
    """
    user_hash = anonymize_id(req.user_id)
    
    log = UserJourneyLog(
        user_hash=user_hash,
        origin_lat=req.origin_lat,
        origin_lng=req.origin_lng,
        dest_lat=req.dest_lat,
        dest_lng=req.dest_lng,
        origin_name=req.origin_name,
        dest_name=req.dest_name
    )
    db.add(log)
    db.commit()
    
    # Trigger re-discovery periodically or on-demand
    HabitDiscoveryService.discover_habits(user_hash)
    
    return {"status": "suggested" if len(HabitDiscoveryService.discover_habits(user_hash)) > 0 else "logged"}

@router.get("/suggestions/{user_id}", response_model=List[PatternResponse])
async def get_suggestions(user_id: str, db: Session = Depends(get_db)):
    """
    Returns discovered patterns for a specific user.
    """
    user_hash = anonymize_id(user_id)
    patterns = db.query(LearnedPattern).filter(
        LearnedPattern.user_hash == user_hash
    ).order_by(LearnedPattern.confidence.desc()).all()
    
    return patterns
