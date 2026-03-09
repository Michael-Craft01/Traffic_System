from sqlalchemy import create_engine, Column, Integer, String, Float, Enum, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from core.config import settings
import datetime

# SQLALchemy setup
engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- Models ---

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100))
    latitude = Column(Float)
    longitude = Column(Float)
    last_active = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class TrafficHistory(Base):
    __tablename__ = "traffic_history"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sensor_id = Column(String(50), ForeignKey("sensors.id"))
    vehicle_count = Column(Integer, nullable=False)
    congestion_status = Column(String(20), nullable=False) # Simplified for SQLite compatibility
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables if they don't exist
def init_db():
    Base.metadata.create_all(bind=engine)
