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
    def __init__(self, vocab_size, embedding_dim, num_classes, max_len):
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
    class_weights = torch.tensor([[0.05] + [1.0] * len(CATEGORIES), device=device])

    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    print(f"Training started at {current_time} on device {device}")
    
    model.to(device)

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for x_batch, y_batch in train_loader:
            x_batch = x_batch.to(device) # a tensor of character ID sequences
            y_batch = y_batch.to(device) # target labels for each character
            optimizer.zero_grad()
            logits = model(x_batch)
            loss = criterion(logits.reshape(-1, logits.shape[-1]), y_batch.reshape(-1))
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * x_batch.size(0)
        avg_loss = total_loss / len(train_loader.dataset)
        current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        print(f"{current_time} Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.4f}")

        # TODO: add validation elements later

    return model

if __name__ == "__main__":
    banned_dir = "banned"
    corpus_file = "corpus.txt"
    # TODO get the dataset vars
    print(f"Training on X samples")
    # TODO build loaders
    