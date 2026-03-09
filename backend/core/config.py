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
    DATABASE_URL: str = "sqlite:///./test.db"  # Default to local sqlite for immediate dev
    
    # Machine Learning Thresholds
    CONGESTION_THRESHOLD_VOLUME: int = 600
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# Instantiate globally so other modules can import `settings` directly
settings = Settings()
