FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for OpenCV and YOLO
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY traffic_engine/requirements.txt ./traffic_engine/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ./traffic_engine/requirements.txt

# Copy the engine code
COPY traffic_engine/ /app/traffic_engine/
COPY public/ /app/public/

# Set working directory
WORKDIR /app/traffic_engine

# Run in headless mode by default for Docker
ENV HEADLESS=true
ENV BACKEND_URL=http://traffic-backend:8000

CMD ["python", "detector.py"]
