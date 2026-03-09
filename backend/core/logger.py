import logging
import os
import sys

# Define log format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

def get_logger(module_name: str) -> logging.Logger:
    """
    Initializes a standard Python logger for the given module.
    Writes to both the console (stdout) and a rolling log file.
    """
    logger = logging.getLogger(module_name)
    
    # Only configure if the logger doesn't already have handlers (prevent duplicates)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        # 1. Console Handler (for local dev)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(console_handler)
        
        # 2. File Handler (for production crash analysis)
        # Ensure log directory exists
        log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
        os.makedirs(log_dir, exist_ok=True)
        
        file_path = os.path.join(log_dir, "traffic_orchestrator.log")
        file_handler = logging.FileHandler(file_path)
        file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
        logger.addHandler(file_handler)
        
    return logger
