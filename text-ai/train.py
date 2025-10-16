import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from dataset import get_datasets, CATEGORIES
import time

# Hyperparameters
MAX_LEN = 128
BATCH_SIZE = 32
EPOCHS = 3
LEARNING_RATE = 1e-3
EMBEDDING_DIM = 768
NUM_CLASSES = 1 + len(CATEGORIES) # background + len(categories)

class CNNClassifier(nn.Module):
    def __init__(self, vocab_size, embedding_dim, max_len):
        super(CNNClassifier, self).__init__()
        self.max_len = max_len
        self.embedding = nn.Embedding(vocab_size, embedding_dim, padding_idx=0)
        self.conv1 = nn.Conv1d(embedding_dim, 128, kernel_size=5, padding=2)
        self.conv2 = nn.Conv1d(128, 128, kernel_size=3, padding=1)
        self.conv_out = nn.Conv1d(128, NUM_CLASSES, kernel_size=1)
        self.dropout = nn.Dropout(0.3)

    def forward(self, x):
        embedding = self.embedding(x)
        embedding = embedding.permute(0, 2, 1) # [batch, embedding_dim, max_len]
        out = self.conv1(embedding) # create 128 richer signals to capture short range patterns (e.g. -ing)
        out = torch.relu(out)
        out = self.dropout(out) # cull some of the noise
        out = self.conv2(out)
        out = torch.relu(out)
        out = self.dropout(out)
        logits = self.conv_out(out)
        logits = logits.permute(0, 2, 1) # [batch, max_len, num_classes]
        return logits
    
def train_model(model, train_loader, val_loader, epochs, learning_rate, device):
    class_weights = torch.tensor([0.05] + [1.0] * len(CATEGORIES), device=device)

    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=1, verbose=True)

    current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print(f"Training started at {current_time} on device {device}")
    
    model.to(device)
    best_val_loss = float('inf')
    patience_counter = 0
    patience = 3

    for epoch in range(epochs):
        # Training phase
        model.train()
        total_loss = 0
        correct = 0
        total = 0
        
        for batch_idx, (x_batch, y_batch) in enumerate(train_loader):
            x_batch = x_batch.to(device)
            y_batch = y_batch.to(device)
            optimizer.zero_grad()
            logits = model(x_batch)
            loss = criterion(logits.reshape(-1, logits.shape[-1]), y_batch.reshape(-1))
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * x_batch.size(0)
            
            # Calculate accuracy
            predictions = torch.argmax(logits, dim=-1)
            correct += (predictions == y_batch).sum().item()
            total += y_batch.numel()
            
            if (batch_idx + 1) % 50 == 0:
                print(f"  Batch {batch_idx + 1}/{len(train_loader)}, Loss: {loss.item():.4f}")
        
        avg_train_loss = total_loss / len(train_loader.dataset)
        train_accuracy = 100.0 * correct / total
        
        # Validation phase
        model.eval()
        val_loss = 0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                x_batch = x_batch.to(device)
                y_batch = y_batch.to(device)
                logits = model(x_batch)
                loss = criterion(logits.reshape(-1, logits.shape[-1]), y_batch.reshape(-1))
                val_loss += loss.item() * x_batch.size(0)
                
                predictions = torch.argmax(logits, dim=-1)
                val_correct += (predictions == y_batch).sum().item()
                val_total += y_batch.numel()
        
        avg_val_loss = val_loss / len(val_loader.dataset)
        val_accuracy = 100.0 * val_correct / val_total
        
        current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        print(f"{current_time} Epoch {epoch + 1}/{epochs}")
        print(f"  Train Loss: {avg_train_loss:.4f}, Train Acc: {train_accuracy:.2f}%")
        print(f"  Val Loss: {avg_val_loss:.4f}, Val Acc: {val_accuracy:.2f}%")
        
        # Learning rate scheduling
        scheduler.step(avg_val_loss)
        
        # Model checkpointing
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            patience_counter = 0
            torch.save(model.state_dict(), "best_model.pth")
            print(f"  → Best model saved (val_loss: {best_val_loss:.4f})")
        else:
            patience_counter += 1
            print(f"  → No improvement ({patience_counter}/{patience})")
        
        # Early stopping
        if patience_counter >= patience:
            print(f"Early stopping triggered after {epoch + 1} epochs")
            break
    
    # Load best model
    model.load_state_dict(torch.load("best_model.pth"))
    print(f"\nLoaded best model with validation loss: {best_val_loss:.4f}")

    return model

if __name__ == "__main__":
    banned_dir = "banned"
    corpus_file = "corpus.txt"
    train_dataset, val_dataset = get_datasets(banned_dir, corpus_file, max_len=MAX_LEN)
    print(f"Training on {len(train_dataset)} samples, validating on {len(val_dataset)} samples")
    vocab_size = len(train_dataset.dataset.vocab)
    if torch.cuda.is_available():
        print("Number of GPUs:", torch.cuda.device_count())
        print("Current GPU:", torch.cuda.current_device())
        print("GPU Name:", torch.cuda.get_device_name(torch.cuda.current_device()))
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        print("Using MPS (Metal Performance Shaders) for macOS.")
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"Using device: {device}")
    model = CNNClassifier(vocab_size, EMBEDDING_DIM, MAX_LEN)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)
    print("Starting training...")
    
    trained_model = train_model(model, train_loader, val_loader, EPOCHS, LEARNING_RATE, device)
    
    print("Training completed.")
    torchscript_model = torch.jit.script(trained_model)
    torchscript_model.save("text_model.pt")