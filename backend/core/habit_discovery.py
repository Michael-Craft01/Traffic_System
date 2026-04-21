import datetime
from sqlalchemy import func
from core.database import SessionLocal, UserJourneyLog, LearnedPattern
from core.logger import get_logger

logger = get_logger("habit_discovery")

# Sensitivity Settings
MIN_RECURRENCE = 3 # times a route is taken to be considered a habit
COORD_PRECISION = 3 # rounding to 3 decimal places (~110m accuracy)
TIME_BIN_MINS = 30 # group times into 30m windows

class HabitDiscoveryService:
    @classmethod
    def discover_habits(cls, user_hash: str):
        """
        Analyzes raw journey logs for a user and identifies recurring patterns.
        """
        db = SessionLocal()
        try:
            # 1. Fetch recent logs (last 30 days)
            thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
            logs = db.query(UserJourneyLog).filter(
                UserJourneyLog.user_hash == user_hash,
                UserJourneyLog.timestamp >= thirty_days_ago
            ).all()

            if len(logs) < MIN_RECURRENCE:
                return []

            # 2. Extract features and cluster manually (Spatial + Temporal)
            # We use a simple dictionary-based clustering for efficiency in this prototype.
            clusters = {} # Key: (origin_cluster, dest_cluster, time_bin)

            for log in logs:
                o_c = (round(log.origin_lat, COORD_PRECISION), round(log.origin_lng, COORD_PRECISION))
                d_c = (round(log.dest_lat, COORD_PRECISION), round(log.dest_lng, COORD_PRECISION))
                
                # Time binning: e.g., 08:32 -> 08:30
                total_mins = log.timestamp.hour * 60 + log.timestamp.minute
                time_bin = (total_mins // TIME_BIN_MINS) * TIME_BIN_MINS
                
                key = (o_c, d_c, time_bin)
                if key not in clusters:
                    clusters[key] = {
                        "count": 0, 
                        "logs": [], 
                        "o_name": log.origin_name, 
                        "d_name": log.dest_name
                    }
                clusters[key]["count"] += 1
                clusters[key]["logs"].append(log)

            # 3. Identify High-Confidence Patterns
            new_patterns = []
            for key, data in clusters.items():
                if data["count"] >= MIN_RECURRENCE:
                    o_c, d_c, time_bin = key
                    h = time_bin // 60
                    m = time_bin % 60
                    target_time = f"{h:02d}:{m:02d}"

                    # Check if this pattern already exists to avoid duplicates
                    exists = db.query(LearnedPattern).filter(
                        LearnedPattern.user_hash == user_hash,
                        LearnedPattern.target_time == target_time,
                        func.round(LearnedPattern.origin_lat, COORD_PRECISION) == o_c[0],
                        func.round(LearnedPattern.origin_lng, COORD_PRECISION) == o_c[1]
                    ).first()

                    if not exists:
                        # Classification Labeling
                        label = "Frequent Trip"
                        if 6 <= h <= 10: label = "Morning Commute"
                        elif 15 <= h <= 19: label = "Evening Return"
                        
                        pattern = LearnedPattern(
                            user_hash=user_hash,
                            label=label,
                            origin_lat=data["logs"][0].origin_lat,
                            origin_lng=data["logs"][0].origin_lng,
                            dest_lat=data["logs"][0].dest_lat,
                            dest_lng=data["logs"][0].dest_lng,
                            origin_name=data["o_name"],
                            dest_name=data["d_name"],
                            target_time=target_time,
                            confidence=min(1.0, data["count"] / 10.0),
                            last_discovered=datetime.datetime.utcnow()
                        )
                        db.add(pattern)
                        new_patterns.append(pattern)

            db.commit()
            if new_patterns:
                logger.info(f"Discovered {len(new_patterns)} new habits for user {user_hash[:8]}")
            return new_patterns

        except Exception as e:
            logger.error(f"Discovery failed: {e}")
            db.rollback()
            return []
        finally:
            db.close()
