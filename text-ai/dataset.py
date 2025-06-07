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
            
            # Make sure to git push!