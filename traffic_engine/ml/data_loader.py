import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader

class TrafficDataset(Dataset):
    """
    Custom PyTorch Dataset for Time-Series Traffic Data.
    Takes sequences of historical data to predict future states.
    """
    def __init__(self, data_file=None, seq_length=12, pred_length=6, generate_synthetic=False):
        """
        Args:
            data_file (str): Path to CSV file containing historical data.
            seq_length (int): Number of past time steps to use as input (e.g., 12 steps of 5 mins = 1 hour).
            pred_length (int): Number of future time steps to predict (e.g., 6 steps = 30 mins).
        """
        self.seq_length = seq_length
        self.pred_length = pred_length
        
        if generate_synthetic:
            self.data = self._generate_synthetic_data(num_days=30)
        else:
            # We will implement real data loading from DB/CSV later
            self.data = pd.read_csv(data_file)
            
        # Normalize data (simple min-max scaling for demonstration)
        # In production, we'd save the scaler to use during inference
        self.max_vol = self.data['volume'].max()
        self.max_spd = self.data['speed'].max()
        
        self.data['volume_norm'] = self.data['volume'] / self.max_vol
        self.data['speed_norm'] = self.data['speed'] / self.max_spd

    def _generate_synthetic_data(self, num_days=30):
        """
        Generates highly realistic synthetic traffic data simulating a typical highway.
        Includes Weekend vs Weekday patterns, Morning/Evening rushes, and random accidents.
        """
        print(f"Generating HIGH-FIDELITY synthetic traffic data for {num_days} days...")
        intervals_per_day = 288 # 288 5-minute blocks in 24 hours
        total_intervals = intervals_per_day * num_days
        
        volumes = np.zeros(total_intervals)
        
        for day in range(num_days):
            day_of_week = day % 7 # 0-4 is Mon-Fri, 5-6 is Sat-Sun
            start_idx = day * intervals_per_day
            end_idx = start_idx + intervals_per_day
            
            # Base overnight traffic (midnight to 5am) ~ 20-50 cars
            base = np.random.normal(30, 10, intervals_per_day)
            
            if day_of_week < 5:  # WEEKDAY PATTERN
                # Morning Rush (7:00 AM - 9:30 AM) -> index 84 to 114
                rush_m = np.zeros(intervals_per_day)
                rush_m[80:120] = np.sin(np.linspace(0, np.pi, 40)) * 600
                
                # Evening Rush (4:00 PM - 6:30 PM) -> index 192 to 222
                # Fridays (day_of_week == 4) have earlier, heavier evening rushes
                rush_e = np.zeros(intervals_per_day)
                if day_of_week == 4:
                    rush_e[180:230] = np.sin(np.linspace(0, np.pi, 50)) * 750
                else:
                    rush_e[190:230] = np.sin(np.linspace(0, np.pi, 40)) * 650
                    
                # Midday lull
                midday = np.zeros(intervals_per_day)
                midday[120:190] = np.random.normal(250, 40, 70)
                
                daily_vol = base + rush_m + rush_e + midday
                
            else: # WEEKEND PATTERN (Sat, Sun)
                # No sharp rush hours, just a smooth bell curve peaking midday
                weekend_curve = np.zeros(intervals_per_day)
                weekend_curve[100:240] = np.sin(np.linspace(0, np.pi, 140)) * 400
                daily_vol = base + weekend_curve
                
            # Add occasional random "Accident" spikes
            if np.random.random() > 0.8: # 20% chance of anomaly per day
                anomaly_start = np.random.randint(100, 200)
                anomaly_duration = np.random.randint(6, 18) # 30 to 90 mins
                daily_vol[anomaly_start:anomaly_start+anomaly_duration] = np.random.normal(850, 50, anomaly_duration)
                
            volumes[start_idx:end_idx] = daily_vol
                
        # Ensure bounds and integers
        volumes = np.clip(volumes, 10, 1200)
        
        # Speed inversely correlates with volume (more cars = slower speeds)
        # Above 600 volume, speed drops sharply
        speeds = 65 - (np.maximum(volumes - 300, 0) / 900) * 55 
        speed_noise = np.random.normal(0, 3, total_intervals)
        speeds = np.clip(speeds + speed_noise, 5, 75)
        
        # Create timestamps
        timestamps = pd.date_range(start="2024-01-01", periods=total_intervals, freq="5min")
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'volume': volumes,
            'speed': speeds
        })
        return df

    def __len__(self):
        # We can't use the very end of the dataset because we need room for the prediction window
        return len(self.data) - self.seq_length - self.pred_length

    def __getitem__(self, idx):
        # 1. Extract the input sequence (Historical X)
        # Columns: [volume_norm, speed_norm]
        x_start = idx
        x_end = idx + self.seq_length
        x = self.data.iloc[x_start:x_end][['volume_norm', 'speed_norm']].values
        
        # 2. Extract the target sequence (Future Y)
        # Predicting future volume
        y_start = x_end
        y_end = y_start + self.pred_length
        y = self.data.iloc[y_start:y_end]['volume_norm'].values
        
        # Convert to PyTorch tensors
        x_tensor = torch.tensor(x, dtype=torch.float32)
        y_tensor = torch.tensor(y, dtype=torch.float32)
        
        return x_tensor, y_tensor

def get_dataloaders(seq_length=12, pred_length=6, batch_size=32):
    """
    Creates Training and Validation DataLoaders using synthetic data for now.
    """
    # Create full dataset
    full_dataset = TrafficDataset(seq_length=seq_length, pred_length=pred_length, generate_synthetic=True)
    
    # Split into 80% Train, 20% Val
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(full_dataset, [train_size, val_size])
    
    # Create DataLoaders (these handle batching and shuffling)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    return train_loader, val_loader, full_dataset.max_vol

if __name__ == "__main__":
    # Test the dataloader
    train_loader, val_loader, max_vol = get_dataloaders()
    print("Dataloaders created successfully.")
    
    # Look at a single batch
    for batch_x, batch_y in train_loader:
        print(f"Input batch shape: {batch_x.shape} -> (Batch Size, Sequence Length, Features)")
        print(f"Target batch shape: {batch_y.shape} -> (Batch Size, Prediction Length)")
        break
