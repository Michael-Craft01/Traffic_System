from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import ingestion, mobile, routing, telemetry, camera
from core.config import settings
from core.logger import get_logger
from core.database import init_db

# Initialize database tables
init_db()

logger = get_logger("main")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Logic
    logger.info("Initializing Traffic System Brain...")
    init_db()
    # Auto-start the hardcoded AI Node from .env
    from core.camera_service import camera_service
    camera_service.auto_start()
    yield
    # Shutdown Logic
    logger.info("Shutting down Traffic System...")

# 1. Initialize the FastAPI Application
app = FastAPI(
    title=settings.API_TITLE,
    description="The central nervous system connecting CV Cameras, ML Brain, and Mobile Apps.",
    version=settings.API_VERSION,
    lifespan=lifespan
)

# 2. Configure CORS (Allows web dashboards to talk to this API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, restrict this to your exact domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Include our Routers (The endpoints)
# e.g., POST to http://localhost:8000/api/v1/ingest/camera
app.include_router(ingestion.router, prefix="/api/v1/ingest", tags=["Data Ingestion (Cameras)"])

# e.g., GET from http://localhost:8000/api/v1/mobile/state
app.include_router(mobile.router, prefix="/api/v1/mobile", tags=["Mobile Client Interfaces"])

# e.g., POST to http://localhost:8000/api/v1/routing/check-commute
app.include_router(routing.router, prefix="/api/v1/routing", tags=["Recommendation Engine"])

# e.g., POST to http://localhost:8000/api/v1/telemetry/log
app.include_router(telemetry.router, prefix="/api/v1/telemetry", tags=["Usage Telemetry"])

# e.g., POST to http://localhost:8000/api/v1/camera/connect
app.include_router(camera.router, prefix="/api/v1/camera", tags=["Live Camera Control"])

@app.get("/")
async def root():
    return {
        "message": "Traffic Control API is Running.", 
        "docs_url": "/docs" # FastAPI auto-generates beautiful documentation here
    }

if __name__ == "__main__":
    import uvicorn
    # Start the server locally on port 8000
    logger.info("Starting the Traffic Director Backend...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
