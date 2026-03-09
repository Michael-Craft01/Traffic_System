import os
import subprocess
import sys
import shutil
import time

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
exporter_path = os.path.join(current_dir, "data_exporter.py")
trainer_path = os.path.join(current_dir, "train.py")
model_file = os.path.join(current_dir, "traffic_model_best.pth")
backup_file = os.path.join(current_dir, "traffic_model_best.pth.bak")

def run_retraining_loop():
    print("--- Stage 2: Starting Intelligence Loop (Automated Retraining) ---")
    
    # 1. Export Data from SQL
    print("\n[1/4] Exporting live traffic history from SQL...")
    try:
        subprocess.run([sys.executable, exporter_path], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error during data export: {e}")
        return

    # 2. Backup Current Model
    if os.path.exists(model_file):
        print(f"\n[2/4] Backing up current model to {backup_file}...")
        shutil.copy2(model_file, backup_file)

    # 3. Train New Model
    print("\n[3/4] Retraining model on new dataset...")
    try:
        # We specify real data file as an argument if train.py was built to accept it, 
        # or we rely on train.py to look for the exported CSV.
        # Let's assume we update train.py to take a data file or it defaults to historical_traffic.csv.
        subprocess.run([sys.executable, trainer_path], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error during training: {e}")
        # Restore backup if training fails
        if os.path.exists(backup_file):
            shutil.copy2(backup_file, model_file)
        return

    # 4. Success and Cleanup
    print("\n[4/4] Retraining successful! New model is now active.")
    print("      Note: Backend will pick up the new model on next reload.")

if __name__ == "__main__":
    run_retraining_loop()
