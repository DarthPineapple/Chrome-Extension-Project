import os
import re
import time
import torch
import pickle
from torch.utils.data import Dataset, random_split

CATEGORIES = ["drugs", "explicit", "gambling", "social media", "violence"]

CACHE_FILENAME = "dataset_cache.pkl"

class TextDataset(Dataset):
    def __init__(self, banned_dir, corpus_file, max_len=128, vocab=None):
        super().__init__()
        self.max_len = max_len
        self.banned = {}
        for file in os.listdir(banned_dir):
            if not file.endswith(".txt"):
                continue
            category = os.path.splitext(file)[0].lower()
            if category not in CATEGORIES:
                continue
            current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            print(f"Loading {category} from {file} at {current_time}")
            with open(os.path.join(banned_dir, file), 'r', encoding='utf-8') as f:
                self.banned[category] = [line.strip() for line in f if line.strip()]

        # Create category label mapping
        self.category_to_label = {category: idx+1 for idx, category in enumerate(CATEGORIES)}
        self.label_to_category = {idx+1: category for idx, category in enumerate(CATEGORIES)}
        self.label_to_category[0] = "background"

        # Combine banned phrases into one regex per category using word boundaries
        self.banned_regex = {
            category: re.compile(r'\b(?:' + '|'.join(re.escape(phrase) for phrase in phrases) + r')\b', re.IGNORECASE)
            for category, phrases in self.banned.items()
        }

        # Load corpus
        current_time = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        print(f"Loading corpus from {corpus_file} at {current_time}")
        if os.path.exists(CACHE_FILENAME):
            with open(CACHE_FILENAME, 'rb') as f:
                self.data = pickle.load(f)
            print("Loaded dataset from cache.")
        else:
            self.data = []
            with open(corpus_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    char_list = list(line)
                    labels = [0] * len(char_list)
                    for category, regex in self.banned_regex.items():
                        for match in regex.finditer(line):
                            start, end = match.start(), match.end()
                            for i in range(start, end):
                                if i < len(labels):
                                    labels[i] = self.category_to_label[category]
            
                    # Pad or truncate to max_len
                    if len(char_list) < self.max_len:
                        pad_length = self.max_len - len(char_list)
                        char_list += ['<PAD>'] * pad_length
                        labels.extend([0] * pad_length)
                    else:
                        char_list = char_list[:self.max_len]
                        labels = labels[:self.max_len]
                    
                    self.data.append((char_list, labels))

            print(f"Loaded {len(self.data)} lines from corpus.")
            # Cache the dataset
            with open(CACHE_FILENAME, 'wb') as f:
                pickle.dump(self.data, f)
            print(f"Dataset cached to {CACHE_FILENAME}.")

        # Build or load the vocab
        if vocab is None:
            self.build_vocab()
        else:
            self.vocab = vocab
    
    def build_vocab(self):
        print("Building vocabulary...")
        chars = set()
        for char_list, _ in self.data:
            chars.update(char_list)
        self.vocab = {"<PAD>": 0, "<UNK>": 1}
        for char in sorted(chars):
            if char not in self.vocab:
                self.vocab[char] = len(self.vocab)

    def encode_text(self, char_list):
        return [self.vocab.get(char, self.vocab["<UNK>"]) for char in char_list]
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, index):
        char_list, labels = self.data[index]
        text_indices = self.encode_text(char_list)
        x = torch.tensor(text_indices, dtype=torch.long)
        y = torch.tensor(labels, dtype=torch.long)
        return x, y
    
def get_datasets(banned_dir, corpus_file, train_ratio=0.8, max_len=128):
    dataset = TextDataset(banned_dir, corpus_file, max_len=max_len)
    train_size = int(len(dataset) * train_ratio)
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    return train_dataset, val_dataset
    