from flask import Flask, request, jsonify
import torch
import torch.nn.functional as F
from dataset import TextDataset, CATEGORIES
from train import CNNClassifier, MAX_LEN, EMBEDDING_DIM, NUM_CLASSES

app = Flask(__name__)

BANNED_DIR = 'banned'
ALLOWED_WORDS = 'whitelist.txt'
ALLOWED_WORDS_SET = set()

with open(ALLOWED_WORDS, 'r') as f:
    for line in f:
        word = line.strip().lower()
        if word:
            ALLOWED_WORDS_SET.add(word)

CORPUS_FILE = 'corpus.txt'
CONFIDENCE_THRESHOLD = 0.99

dataset_obj = TextDataset(BANNED_DIR, CORPUS_FILE, max_len=MAX_LEN)
vocab = dataset_obj.vocab
vocab_size = len(vocab)
label_to_category = dataset_obj.label_to_category

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = CNNClassifier(vocab_size, EMBEDDING_DIM, MAX_LEN)
# model.load_state_dict(torch.load("cnn_model.pt", map_location=device))

# Alternative: Load scripted model
# model = torch.jit.load('cnn_model_scripted.pt')
model.to(device)
model.eval()

def encode_text(text, vocab, max_len):
    text = text.lower().strip()
    indices = [vocab.get(char, vocab["<UNK>"]) for char in text]
    if len(indices) < max_len:
        pad_len = max_len - len(indices)
        indices.extend([vocab["<PAD>"]] * pad_len)
    else:
        indices = indices[:max_len]
    return torch.tensor(indices, dtype=torch.long)

def decode_labels(label_seq, label_to_category, min_span_length=3):
    spans = []
    current_label = None
    for i, label in enumerate(label_seq):
        if label != 0:
            category = label_to_category[label]
            if current_label is None:
                current_label = {"start": i, "end": i, "category": category}
            else:
                if current_label["category"] == category:
                    current_label["end"] = i
                else:
                    spans.append(current_label)
                    current_label = {"start": i, "end": i, "category": category}
        else:
            if current_label is not None:
                spans.append(current_label)
                current_label = None
    if current_label is not None:
        spans.append(current_label)
    filtered_spans = [span for span in spans if (span["end"] - span["start"]) >= min_span_length]
    return filtered_spans


def expand_to_word_boundaries(text, start, end):
    while start > 0 and not text[start-1].isspace():
        start -= 1
    while end < len(text) and not text[end].isspace():
        end += 1
    return start, end

@app.route('/predict_text', methods=['POST'])
def predict_text():
    data = request.get_json()
    if 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400
    
    texts = data['text']
    if not isinstance(texts, list):
        return jsonify({'error': 'Text should be a list of strings'}), 400
    
    batch = []
    for text in texts:
        encoded = encode_text(text, vocab, MAX_LEN)
        batch.append(encoded)
    batch = torch.stack(batch).to(device)

    with torch.no_grad():
        logits = model(batch)
        probs = torch.softmax(logits, dim=-1)
        max_probs, predictions = torch.max(probs, dim=-1)
        predictions[max_probs < CONFIDENCE_THRESHOLD] = 0
    
    predictions = predictions.cpu().tolist()
    results = []
    for text, pred_seq in zip(texts, predictions):
        effective_length = min(len(text), MAX_LEN)
        pred_seq = pred_seq[:effective_length] # Trim off the padding we previously added
        spans = decode_labels(pred_seq, label_to_category)

        # Further filter through whitelist
        filtered_spans = [span for span in spans if text[span["start"]:span["end"]+1].strip().lower() not in ALLOWED_WORDS_SET]

        final_spans = []
        for span in filtered_spans:
            start, end = expand_to_word_boundaries(text, span["start"], span["end"])
            span["start"] = start
            span["end"] = end
            new_span_text = text[start:end].strip()
            if new_span_text and new_span_text.lower() not in ALLOWED_WORDS_SET:
                final_spans.append(span)

        results.append({'text': text, 'spans': final_spans})
    return jsonify(results)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)