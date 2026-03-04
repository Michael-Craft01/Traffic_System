import torch
import torch.nn as nn
import torch.optim as optim
import os
from data_loader import get_dataloaders
from model import TrafficPredictorLSTM

def train_model(epochs=10, batch_size=32, learning_rate=0.001, seq_length=12, pred_length=6):
    """
    Trains the LSTM model on synthetic traffic data.
    """
    print(f"--- Starting Training Core ML Predictor ---")
    print(f"Device configuration...")
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    # 1. Load Data
    print("Loading datasets...")
    train_loader, val_loader, max_vol = get_dataloaders(seq_length=seq_length, pred_length=pred_length, batch_size=batch_size)
    
    # 2. Initialize Model
    # Input size is 2 (volume, speed)
    model = TrafficPredictorLSTM(input_size=2, hidden_size=64, num_layers=2, output_size=pred_length)
    model.to(device)
    
    # 3. Define Loss Function and Optimizer
    # MSE (Mean Squared Error) is standard for regression tasks
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    best_val_loss = float('inf')
    
    # 4. Training Loop
    for epoch in range(1, epochs + 1):
        model.train() # Set to training mode
        train_loss = 0.0
        
        for batch_i, (x, y) in enumerate(train_loader):
            x, y = x.to(device), y.to(device)
            
            # Zero the parameter gradients
            optimizer.zero_grad()
            
            # Forward pass
            outputs = model(x)
            
            # Calculate loss
            loss = criterion(outputs, y)
            
            # Backward pass and optimize
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * x.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # 5. Validation Loop
        model.eval() # Set to evaluation mode (disables dropout, etc)
        val_loss = 0.0
        
        with torch.no_grad(): # Don't track gradients for validation
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                outputs = model(x)
                loss = criterion(outputs, y)
                val_loss += loss.item() * x.size(0)
                
        val_loss /= len(val_loader.dataset)
        
        print(f"Epoch [{epoch}/{epochs}] | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
        
        # Save the best model
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            save_path = "traffic_model_best.pth"
            torch.save(model.state_dict(), save_path)
            print(f"  -> Model saved to {save_path}")

    print("--- Training Complete ---")
    print(f"Note: Max volume was {max_vol} (needed to reverse normalization during inference)")
    
    # Save the max volume so inference script knows how to scale responses back
    with open("model_metadata.txt", "w") as f:
        f.write(str(max_vol))

if __name__ == "__main__":
    train_model(epochs=5) # 5 epochs for quick demonstration
