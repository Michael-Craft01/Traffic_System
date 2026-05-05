import redis
import json
import time
from core.config import settings
from core.logger import get_logger

logger = get_logger("redis_manager")

class RedisManager:
    """
    Manages the connection to the Redis server for ultra-fast, in-memory state storage.
    Instead of hitting a SQL database to check if a road is congested,
    millions of mobile users can hit Redis instantly.
    """
    def __init__(self):
        self._fallback_storage = {} # Local memory fallback if Redis is down
        self._route_load_fallback = {} # Fallback for load balancing
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST, 
                port=settings.REDIS_PORT, 
                db=0, 
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("Successfully connected to Redis State Manager")
        except redis.exceptions.ConnectionError:
            logger.warning(f"WARNING: Redis not found at {settings.REDIS_HOST}. Using in-memory fallback storage.")
            self.redis_client = None

    def set_camera_state(self, camera_id: str, data: dict):
        """Saves the live camera data. Expires after 60 seconds if using Redis."""
        if self.redis_client:
            key = f"camera_state:{camera_id}"
            self.redis_client.setex(key, 60, json.dumps(data))
            return True
        else:
            # Fallback to local memory dictionary
            data["_timestamp"] = time.time()
            self._fallback_storage[camera_id] = data
            return True

    def get_all_camera_states(self):
        """Fetches the state of every active camera."""
        if self.redis_client:
            states = {}
            keys = self.redis_client.keys("camera_state:*")
            for key in keys:
                camera_id = key.split(":")[1]
                data_str = self.redis_client.get(key)
                if data_str:
                    states[camera_id] = json.loads(data_str)
            return states
        else:
            # Fallback: Clean up expired local entries (older than 60s)
            now = time.time()
            expired = [k for k, v in self._fallback_storage.items() if now - v.get("_timestamp", 0) > 60]
            for k in expired:
                del self._fallback_storage[k]
            return self._fallback_storage

    def increment_route_load(self, route_id: str, time_slot_mins: int, increment: int = 1):
        """Track how many users have been assigned a specific route at a specific time slot."""
        key = f"route_load:{route_id}:{time_slot_mins}"
        if self.redis_client:
            self.redis_client.incrby(key, increment)
            self.redis_client.expire(key, 1800) # expire in 30 mins
            val = self.redis_client.get(key)
            return int(val) if val else increment
        else:
            current = self._route_load_fallback.get(key, {})
            count = current.get("count", 0) + increment
            self._route_load_fallback[key] = {"count": count, "_timestamp": time.time()}
            return count

    def get_route_load(self, route_id: str, time_slot_mins: int):
        """Retrieve the artificial load for a specific route and time slot."""
        key = f"route_load:{route_id}:{time_slot_mins}"
        if self.redis_client:
            val = self.redis_client.get(key)
            return int(val) if val else 0
        else:
            # Clean up old loads (> 30 mins)
            now = time.time()
            expired = [k for k, v in self._route_load_fallback.items() if now - v.get("_timestamp", 0) > 1800]
            for k in expired:
                del self._route_load_fallback[k]
                
            return self._route_load_fallback.get(key, {}).get("count", 0)

    def report_incident(self, area_id: str, severity: int = 500, ttl_seconds: int = 1800):
        """Artificially spike the volume of an area due to an incident."""
        key = f"incident:{area_id}"
        if self.redis_client:
            self.redis_client.setex(key, ttl_seconds, severity)
            return True
        else:
            self._route_load_fallback[key] = {"severity": severity, "_timestamp": time.time()}
            return True

    def get_incident_penalty(self, area_id: str):
        """Retrieve the active incident penalty for an area."""
        key = f"incident:{area_id}"
        if self.redis_client:
            val = self.redis_client.get(key)
            return int(val) if val else 0
        else:
            now = time.time()
            data = self._route_load_fallback.get(key, {})
            if now - data.get("_timestamp", 0) > 1800:
                return 0
            return data.get("severity", 0)

# Create a singleton instance to be imported by the API endpoints
redis_manager = RedisManager()
