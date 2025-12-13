import json
import os

banned_dir = "./text-ai/banned"
files = os.listdir(banned_dir)
banned_words = {}
for filename in files:
    banned_words[os.path.splitext(filename)[0]] = []
    with open(os.path.join(banned_dir, filename), 'r') as f:
        for line in f:
            banned_words[os.path.splitext(filename)[0]].append(line.strip())

with open("./extension/banned.json", 'w') as f:
    json.dump(banned_words, f, indent=4)