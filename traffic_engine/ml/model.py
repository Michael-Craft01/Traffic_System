import torch
import torch.nn as nn

class TrafficPredictorLSTM(nn.Module):
    """
    LSTM Model for Time-Series Traffic Forecasting.
    """
    def __init__(self, input_size=2, hidden_size=64, num_layers=2, output_size=6):
        """
        Args:
            input_size (int): Number of input features (default 2: volume and speed).
            hidden_size (int): Number of features in the hidden state of the LSTM.
            num_layers (int): Number of recurrent layers.
            output_size (int): Number of future time steps to predict.
        """
        super(TrafficPredictorLSTM, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.output_size = output_size
        
        # The core LSTM network
        # batch_first=True meaning input shape is (batch, seq, feature)
        self.lstm = nn.LSTM(input_size=input_size, 
                            hidden_size=hidden_size, 
                            num_layers=num_layers, 
                            batch_first=True,
                            dropout=0.2 if num_layers > 1 else 0)
        
        # Fully connected layer to map from the LSTM's hidden state to our desired output shape
        self.fc = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        """
        Forward pass of the model.
        Args:
            x (Tensor): Input sequence of shape (batch_size, seq_length, input_size)
        """
        batch_size = x.size(0)
        
        # Initialize hidden state and cell state with zeros
        # Shape: (num_layers, batch_size, hidden_size)
        h0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(x.device)
        
        # Pass sequence through LSTM
        # out shape: (batch_size, seq_length, hidden_size)
        # we don't need the final hidden states (hn, cn), just the output sequence
        out, _ = self.lstm(x, (h0, c0))
        
        # We only care about the output from the final time step of the sequence to make our prediction
        # Get the context of the last time step: shape (batch_size, hidden_size)
        last_time_step_out = out[:, -1, :]
        
        # Pass through the fully connected layer to get the final predictions
        # Shape: (batch_size, output_size)
        predictions = self.fc(last_time_step_out)
        
        return predictions

if __name__ == "__main__":
    # Test the model structure
    model = TrafficPredictorLSTM(input_size=2, hidden_size=64, num_layers=2, output_size=6)
    
    # Create fake batch of data: Batch Size 32, Sequence Length 12, Features 2 (volume, speed)
    dummy_input = torch.randn(32, 12, 2)
    
    # Run forward pass
    output = model(dummy_input)
    
    print(f"Model Summary:")
    print(f"Input shape: {dummy_input.shape}")
    print(f"Output shape: {output.shape} -> Expected: (32, 6)")
