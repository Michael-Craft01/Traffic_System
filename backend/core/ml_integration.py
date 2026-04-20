import os
import sys
import datetime
import math

# Add the traffic_engine/ml folder to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir    = os.path.dirname(os.path.dirname(current_dir))
ml_dir      = os.path.join(root_dir, "traffic_engine", "ml")
if ml_dir not in sys.path:
    sys.path.append(ml_dir)

from core.database import SessionLocal, TrafficHistory
from core.redis import redis_manager
from core.logger import get_logger
from sqlalchemy import desc

logger = get_logger("ml_integration")

# ── Load ML Brain ──────────────────────────────────────────────────
try:
    from inference import BrainInference

    model_path    = os.path.join(ml_dir, "traffic_model_best.pth")
    metadata_path = os.path.join(ml_dir, "model_metadata.txt")

    ml_brain = BrainInference(model_path=model_path, metadata_path=metadata_path)
    logger.info("ML Brain loaded successfully")

except ImportError as e:
    logger.error(f"Could not load ML Brain: {e}")
    ml_brain = None


# ── Synthetic data generator ───────────────────────────────────────
def _synthetic_volume(hour: int, weekday: int) -> int:
    """
    Generate a plausible vehicle count for a given hour of the day.
    Models realistic rush-hour peaks without needing a live camera feed.
    """
    is_weekend = weekday >= 5

    # Base curve: morning peak 7–9, evening peak 16–18
    morning = 700 * math.exp(-0.5 * ((hour - 8) / 1.2) ** 2)
    evening = 800 * math.exp(-0.5 * ((hour - 17) / 1.3) ** 2)
    night   = 80

    vol = int(max(night, morning + evening))
    if is_weekend:
        vol = int(vol * 0.55)

    # Add mild noise
    import random
    vol += random.randint(-20, 20)
    return max(0, vol)


def _synthetic_speed(volume: int, max_vol: float = 1000.0) -> float:
    """Derive speed from volume: higher volume → lower speed (gridlock model)."""
    ratio = min(volume / max_vol, 1.0)
    speed = max(5.0, 80.0 * (1.0 - ratio ** 0.6))
    return round(speed, 1)


# ── Core function ──────────────────────────────────────────────────
def get_recent_history(route_id: str) -> list:
    """
    Returns exactly 12 data points: [[volume, speed, hour, day], ...]
    Priority:
      1. Real SQL history from the camera feed
      2. Redis live state for the most-recent slot
      3. Synthetic data for cold-start / no camera
    """
    SEQ_LEN  = 12
    now      = datetime.datetime.now()
    max_vol  = getattr(ml_brain, "max_vol", 1000.0) if ml_brain else 1000.0

    # ── Step 1: Pull real SQL history ─────────────────────────────
    db = SessionLocal()
    try:
        rows = (
            db.query(TrafficHistory)
              .filter(TrafficHistory.sensor_id == route_id)
              .order_by(desc(TrafficHistory.timestamp))
              .limit(SEQ_LEN - 1)
              .all()
        )
        rows.reverse()
    finally:
        db.close()

    window = []
    for row in rows:
        vol   = row.vehicle_count
        speed = _synthetic_speed(vol, max_vol)
        window.append([vol, speed, row.timestamp.hour, row.timestamp.weekday()])

    # ── Step 2: Append live Redis state as the final slot ─────────
    states     = redis_manager.get_all_camera_states()
    live_state = states.get(route_id, {}) if isinstance(states, dict) else {}
    live_vol   = live_state.get("total_flow", None)

    if live_vol is not None:
        live_speed = _synthetic_speed(live_vol, max_vol)
        window.append([int(live_vol), live_speed, now.hour, now.weekday()])
    else:
        # No live camera — generate a synthetic last-point
        vol   = _synthetic_volume(now.hour, now.weekday())
        speed = _synthetic_speed(vol, max_vol)
        window.append([vol, speed, now.hour, now.weekday()])

    # ── Step 3: Cold-start fill (enough synthetic history) ────────
    while len(window) < SEQ_LEN:
        # Fill backwards in time
        offset_hours = SEQ_LEN - len(window)
        past = now - datetime.timedelta(hours=offset_hours)
        vol  = _synthetic_volume(past.hour, past.weekday())
        spd  = _synthetic_speed(vol, max_vol)
        window.insert(0, [vol, spd, past.hour, past.weekday()])

    # Guarantee exactly SEQ_LEN entries
    return window[-SEQ_LEN:]
