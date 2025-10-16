import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import torch
import torch.nn.functional as F
from dataset import TextDataset, CATEGORIES
from train import CNNClassifier, MAX_LEN, EMBEDDING_DIM, NUM_CLASSES
import logging
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('text_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure CORS with specific origins
CORS(app, resources={
    r"/predict_text": {
        "origins": [
            "chrome-extension://*",
            "http://localhost:*",
        ]
    }
})

# Rate limiting - Increased by 100x for large dataset testing
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000000 per day", "100000 per hour"],  # 100x increase
    storage_uri="memory://"
)

# Security configurations - Adjusted for smaller packet testing
MAX_TEXT_LENGTH = 5000  # Decreased from 50,000
MAX_TEXTS_PER_REQUEST = 100  # Kept same for batch processing
MAX_REQUEST_SIZE = 1 * 1024 * 1024  # 1MB max request size (decreased from 10MB)
app.config['MAX_CONTENT_LENGTH'] = MAX_REQUEST_SIZE

BANNED_DIR = 'banned'
BLACKLIST_FILE = 'blacklist.json'

try:
    with open(BLACKLIST_FILE, 'r') as f:
        BLACKLIST = json.load(f)
    logger.info("Blacklist loaded successfully")
except Exception as e:
    logger.error(f"Failed to load blacklist: {e}")
    BLACKLIST = {}

ALLOWED_WORDS = 'whitelist.txt'
ALLOWED_WORDS_SET = set()

try:
    with open(ALLOWED_WORDS, 'r') as f:
        for line in f:
            word = line.strip().lower()
            if word:
                ALLOWED_WORDS_SET.add(word)
    logger.info(f"Loaded {len(ALLOWED_WORDS_SET)} allowed words")
except Exception as e:
    logger.error(f"Failed to load whitelist: {e}")

CORPUS_FILE = 'corpus.txt'
CONFIDENCE_THRESHOLD = 0.50

try:
    dataset_obj = TextDataset(BANNED_DIR, CORPUS_FILE, max_len=MAX_LEN)
    vocab = dataset_obj.vocab
    vocab_size = len(vocab)
    label_to_category = dataset_obj.label_to_category
    logger.info("Dataset loaded successfully")
except Exception as e:
    logger.error(f"Failed to load dataset: {e}")
    vocab = None
    label_to_category = None

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

try:
    model = CNNClassifier(vocab_size, EMBEDDING_DIM, MAX_LEN)
    #model currently not loading weights for testing
    #model.load_state_dict(torch.load("cnn_model.pt", map_location=device, weights_only=True))
    model.to(device)
    model.eval()
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    model = None

def validate_input(data):
    """Validate incoming request data"""
    if 'text' not in data:
        return False, 'No text provided'
    
    texts = data['text']
    if not isinstance(texts, list):
        return False, 'Text should be a list of strings'
    
    if len(texts) == 0:
        return False, 'Text list is empty'
    
    if len(texts) > MAX_TEXTS_PER_REQUEST:
        return False, f'Too many texts (max {MAX_TEXTS_PER_REQUEST})'
    
    for i, text in enumerate(texts):
        if not isinstance(text, str):
            return False, f'Text at index {i} is not a string'
        
        if len(text) > MAX_TEXT_LENGTH:
            return False, f'Text at index {i} too long (max {MAX_TEXT_LENGTH} chars)'
        
        # Basic sanitization check
        if '\x00' in text:  # Null byte injection
            return False, f'Invalid characters in text at index {i}'
    
    return True, None

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

def safe_find_word_in_text(text_lower, word):
    """Safely find word in text, avoiding ReDoS and errors"""
    try:
        # Use regex with word boundaries for exact matches
        pattern = r'\b' + re.escape(word) + r'\b'
        match = re.search(pattern, text_lower)
        if match:
            return match.start(), match.end()
        return None, None
    except Exception as e:
        logger.error(f"Error finding word '{word}': {e}")
        return None, None

@app.route('/predict_text', methods=['POST'])
@limiter.limit("10000 per minute")  # 100x increase from 100 per minute
def predict_text():
    # Check if model and vocab are loaded
    if model is None or vocab is None or label_to_category is None:
        logger.error("Model or dataset not loaded")
        return jsonify({'error': 'Service not available'}), 503
    
    try:
        data = request.get_json()
    except Exception as e:
        logger.warning(f"Invalid JSON: {e}")
        return jsonify({'error': 'Invalid JSON'}), 400
    
    # Validate input
    is_valid, error_msg = validate_input(data)
    if not is_valid:
        logger.warning(f"Invalid input: {error_msg}")
        return jsonify({'error': error_msg}), 400
    
    texts = data['text']
    logger.info(f"Processing {len(texts)} texts")
    
    try:
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
            pred_seq = pred_seq[:effective_length]
            spans = decode_labels(pred_seq, label_to_category)

            # Filter through whitelist
            filtered_spans = [span for span in spans if text[span["start"]:span["end"]+1].strip().lower() not in ALLOWED_WORDS_SET]

            final_spans = []
            for span in filtered_spans:
                start, end = expand_to_word_boundaries(text, span["start"], span["end"])
                span["start"] = start
                span["end"] = end
                new_span_text = text[start:end].strip()
                if new_span_text and new_span_text.lower() not in ALLOWED_WORDS_SET:
                    final_spans.append(span)

            results_dict = {"text": text, "spans": final_spans}

            # Final filter through blacklist (optimized)
            text_lower = text.lower()
            words_in_text = set(text_lower.split())
            
            for category, banned_words in BLACKLIST.items():
                # Check intersection for efficiency
                matching_words = words_in_text.intersection(set(banned_words))
                for word in matching_words:
                    start_pos, end_pos = safe_find_word_in_text(text_lower, word)
                    if start_pos is not None:
                        results_dict["spans"].append({
                            'start': start_pos,
                            'end': end_pos,
                            'category': category
                        })

            results.append(results_dict)
        
        logger.info(f"Prediction successful: {len(results)} texts processed")
        return jsonify(results), 200
        
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'vocab_loaded': vocab is not None
    }), 200

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle request too large error"""
    logger.warning("Request too large")
    return jsonify({'error': 'Request too large (max 1MB)'}), 413

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded"""
    logger.warning(f"Rate limit exceeded: {get_remote_address()}")
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5004, debug=False)