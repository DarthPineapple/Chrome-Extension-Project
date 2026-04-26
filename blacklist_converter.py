import os
import json

"""
Original format:
{
    "drugs": [
        "cocaine",
    ],
    "explicit": [
        "fuck"
    ],
    "gambling": [
        "poker",
    ],
    "social media": [
        "Facebook",
    ],
    "violence": [
        "murder"
    ]
}

New Format:
[
     { "term": "cocaine", "payload": "drug" },
     { "term": "heroin", "payload": "drug" },
     { "term": "meth", "payload": "drug" },
     { "term": "methamphetamine", "payload": "drug" },
     { "term": "LSD", "payload": "drug" },
     { "term": "ecstasy", "payload": "drug" },
     { "term": "marijuana", "payload": "drug" },
     { "term": "crack cocaine", "payload": "drug" },
     { "term": "ketamine", "payload": "drug" },
     { "term": "fentanyl", "payload": "drug" },
     { "term": "not", "payload": "drug"}
]

"""

original_blacklist_path = "./extension/banned.json"
new_blacklist_path = "./extension/blacklist.json"

# Open the json file and load the data

with open(original_blacklist_path, 'r') as file:
    data = json.load(file)
    
    new_data = []
    for category, terms in data.items():
        for term in terms:
            new_data.append({"term": term, "payload": category})
    with open(new_blacklist_path, 'w') as new_file:
        json.dump(new_data, new_file, indent=4)

# Verify the conversion
with open(new_blacklist_path, 'r') as new_file:
    new_data = json.load(new_file)
    print(new_data)