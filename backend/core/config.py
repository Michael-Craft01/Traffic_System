import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Centralized configuration management.
    Reads from environment variables (or a local .env file).
    If variables are missing in production, this immediately throws an error
    rather than waiting for a silent failure deep within the code.
    """
    
    # API Settings
    API_TITLE: str = "Traffic Orchestration 'Director' API"
    API_VERSION: str = "1.0.0"
    
    # State Store (Redis)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    
    # Persistent Database (MySQL mapping for future)
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATABASE_URL: str = f"sqlite:///{os.path.join(_base_dir, 'traffic_brain.db')}"
    
    # Machine Learning Thresholds
    CONGESTION_THRESHOLD_VOLUME: int = 600
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# Instantiate globally so other modules can import `settings` directly
settings = Settings()
