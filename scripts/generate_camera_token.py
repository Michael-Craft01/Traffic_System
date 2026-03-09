import sys
import os

# Add backend to path so we can import core
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.security import create_access_token
from datetime import timedelta

def generate_token(device_id: str):
    """
    Generate a long-lived token for a traffic camera or simulator.
    """
    # 1 year token for static devices
    access_token = create_access_token(
        data={"sub": device_id}, 
        expires_delta=timedelta(days=365)
    )
    print(f"\n--- JWT TOKEN GENERATED ---")
    print(f"Device ID: {device_id}")
    print(f"Token: {access_token}")
    print(f"---------------------------\n")
    print("Add this to your detector.py or camera config as an 'Authorization' header:")
    print(f"Header: Authorization: Bearer {access_token}")

if __name__ == "__main__":
    device = input("Enter Device ID (e.g. cam_main_01): ") or "cam_main_01"
    generate_token(device)
