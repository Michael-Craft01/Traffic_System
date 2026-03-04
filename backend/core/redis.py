import redis
import json

class RedisManager:
    """
    Manages the connection to the Redis server for ultra-fast, in-memory state storage.
    Instead of hitting a SQL database to check if a road is congested,
    millions of mobile users can hit Redis instantly.
    """
    def __init__(self, host="localhost", port=6379, db=0):
        # We wrap in try block so the app doesn't crash if Redis isn't running locally yet
        try:
            self.redis_client = redis.Redis(host=host, port=port, db=db, decode_responses=True)
            # Ping to test connection
            self.redis_client.ping()
            print("✅ Successfully connected to Redis State Manager")
        except redis.exceptions.ConnectionError:
            print("⚠️ WARNING: Could not connect to Redis. Ensure it is running on localhost:6379")
            self.redis_client = None

    def set_camera_state(self, camera_id: str, data: dict):
        """Saves the live camera data to Redis. Expires after 60 seconds if no update."""
        if self.redis_client:
            # We use a key like 'camera_state:cam_01'
            key = f"camera_state:{camera_id}"
            # TTL of 60 seconds. If the camera dies, the state clears automatically
            self.redis_client.setex(key, 60, json.dumps(data))
            return True
        return False

    def get_all_camera_states(self):
        """Fetches the state of every active camera on the network."""
        if not self.redis_client:
            return {"error": "Redis not connected"}
            
        states = {}
        # Find all keys matching our pattern
        keys = self.redis_client.keys("camera_state:*")
        for key in keys:
            # Extract just the camera ID from the key
            camera_id = key.split(":")[1]
            # Parse the JSON string back into a Python dict
            data_str = self.redis_client.get(key)
            if data_str:
                states[camera_id] = json.loads(data_str)
                
        return states

# Create a singleton instance to be imported by the API endpoints
redis_manager = RedisManager()
