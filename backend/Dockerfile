FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for ML and CV
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt ./backend_requirements.txt
COPY traffic_engine/requirements.txt ./traffic_engine_requirements.txt
RUN pip install --no-cache-dir -r backend_requirements.txt -r traffic_engine_requirements.txt

# Copy backend code and ML engine
COPY backend/ ./backend/
COPY traffic_engine/ ./traffic_engine/

# Set working directory to backend for uvicorn
WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
