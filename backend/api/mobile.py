from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from core.redis import redis_manager
from core.ml_integration import ml_brain, get_recent_history
from core.logger import get_logger

logger = get_logger("mobile_api")

router = APIRouter()

class IncidentReport(BaseModel):
    area_id: str
    penalty: int

@router.post("/incident")
async def report_incident(report: IncidentReport):
    redis_manager.report_incident(report.area_id, report.penalty)
    return {"status": "success", "message": f"Incident reported at {report.area_id}"}

@router.get("/state")
async def get_live_traffic_state():
    """
    Returns the live state of every active camera plus ML predictions.
    Used by the Next.js dashboard (via /api/traffic proxy).
    Falls back to synthetic ML data when no real camera is streaming.
    """
    # 1. Fetch camera data from Redis
    live_data = redis_manager.get_all_camera_states()

    # Sanitise: redis_manager returns {"error": ...} when Redis is down
    if not isinstance(live_data, dict) or "error" in live_data:
        live_data = {}

    # 2. If no cameras are live, generate synthetic demo data so the
    #    frontend always has something real-ish to display.
    if not live_data:
        import datetime, math, random
        now = datetime.datetime.now()
        h   = now.hour

        def _vol(hour):
            m = 700 * math.exp(-0.5 * ((hour - 8) / 1.2) ** 2)
            e = 800 * math.exp(-0.5 * ((hour - 17) / 1.3) ** 2)
            return max(80, int(m + e)) + random.randint(-15, 15)

        demo_vol    = _vol(h)
        demo_status = "CONGESTED" if demo_vol > 600 else "MODERATE" if demo_vol > 350 else "CLEAR"
        live_data   = {
            "cam_main_01": {
                "camera_id":   "cam_main_01",
                "total_flow":  demo_vol,
                "status":      demo_status,
                "latitude":    -17.8292,
                "longitude":    31.0522,
                "server_time": now.timestamp(),
                "source":      "synthetic",
            }
        }
        logger.info(f"No live cameras — serving synthetic data: {demo_vol} vehicles ({demo_status})")

    # 3. Optionally merge ML predictions
    predictions = {}
    if ml_brain:
        for cam_id in live_data:
            try:
                history      = await run_in_threadpool(get_recent_history, cam_id)
                preds        = await run_in_threadpool(ml_brain.predict_future_traffic, history)
                predictions[cam_id] = preds
            except Exception as exc:
                logger.warning(f"Prediction failed for {cam_id}: {exc}")

    return {
        "status":      "success",
        "live_nodes":  len(live_data),
        "data":        live_data,
        "predictions": predictions,
    }
