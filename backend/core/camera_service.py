import subprocess
import os
import signal
import sys
import time
from typing import Optional
from core.config import settings
from core.logger import get_logger

logger = get_logger("camera_service")

class CameraService:
    _process: Optional[subprocess.Popen] = None
    _current_config: Optional[dict] = None
    
    # --- DYNAMIC SETTINGS (from .env) ---
    DEFAULT_IP = settings.TRAFFIC_PHONE_IP
    DEFAULT_PORT = settings.TRAFFIC_PHONE_PORT
    DEFAULT_NODE = "cam_main_01"

    @classmethod
    def auto_start(cls):
        """Automatically starts the detector on system boot"""
        logger.info("System Boot: Initializing AI Node from central config...")
        # Refresh settings in case .env was changed while backend was running
        return cls.start(settings.TRAFFIC_PHONE_IP, settings.TRAFFIC_PHONE_PORT, cls.DEFAULT_NODE)

    @classmethod
    def start(cls, ip: str, port: str, camera_id: str):
        """Starts the YOLO detector process"""
        if cls._process and cls._process.poll() is None:
            logger.info("Detector already running. Stopping previous instance...")
            cls.stop()

        detector_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "traffic_engine", "detector.py"))
        
        # Build command - Try 'python' then 'py' if sys.executable fails
        python_exe = sys.executable or "python"
        cmd = [
            python_exe, 
            detector_path,
            "--ip", ip,
            "--port", port,
            "--camera_id", camera_id
        ]

        try:
            logger.info(f"Attempting to launch AI Node: {camera_id} at {ip}:{port}")
            logger.info(f"Command: {' '.join(cmd)}")
            
            # Start process - No pipes so it can open a GUI window on Windows
            root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            cls._process = subprocess.Popen(
                cmd,
                cwd=root_dir,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            
            # Quick check if it crashed immediately
            time.sleep(2) # Give it more time to initialize YOLO
            if cls._process.poll() is not None:
                logger.error("Detector process exited prematurely. Check the console above for errors.")
                return False

            cls._current_config = {"ip": ip, "port": port, "camera_id": camera_id}
            return True
        except Exception as e:
            logger.error(f"CRITICAL: Failed to launch detector process: {e}")
            return False

    @classmethod
    def stop(cls):
        """Stops the detector process"""
        if cls._process:
            logger.info("Terminating AI detector process...")
            cls._process.terminate()
            try:
                cls._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                cls._process.kill()
            cls._process = None
            cls._current_config = None
            return True
        return False

    @classmethod
    def get_status(cls):
        """Returns the current status of the detector"""
        is_running = cls._process is not None and cls._process.poll() is None
        return {
            "is_running": is_running,
            "config": cls._current_config if is_running else None
        }

camera_service = CameraService()
