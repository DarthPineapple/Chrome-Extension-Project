from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from ultralytics import YOLO
from PIL import Image
from io import BytesIO
import logging
from werkzeug.utils import secure_filename

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize the Flask app
app = Flask(__name__)

# Configure CORS with specific origins (update with your extension ID)
CORS(app, resources={
    r"/predict_image": {
        "origins": [
            "chrome-extension://*",  # Allow Chrome extensions
            "http://localhost:*",     # Allow local development
        ]
    }
})

# Rate limiting - Increased by 100x for high-volume testing
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["20000 per day", "5000 per hour"],  # 100x increase
    storage_uri="memory://"
)

# Security configurations
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'}
ALLOWED_MIME_TYPES = {
    'image/png', 'image/jpeg', 'image/jpg', 
    'image/gif', 'image/bmp', 'image/webp',  # Remove 'image/svg+xml'
    'image/svg'
}

# Load the YOLOv8 model
try:
    model = YOLO("image_model.pt")
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    model = None

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image(file):
    """Validate image file type and content"""
    # Check MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        return False, f"Invalid file type. {file.content_type} is not supported."
    
    # Check file extension
    if not allowed_file(file.filename):
        return False, "Invalid file extension"
    
    # Verify it's actually an image by trying to open it
    try:
        img = Image.open(file.stream)
        img.verify()  # Verify it's a valid image
        file.stream.seek(0)  # Reset stream for later use
        return True, None
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

@app.route('/predict_image', methods=['POST'])
@limiter.limit("1000 per minute")  # 100x increase from 10 per minute
def predict():
    # Check if model is loaded
    if model is None:
        logger.error("Model not loaded")
        return jsonify({'error': 'Model not available'}), 503
    
    # Validate request
    if 'image' not in request.files:
        logger.warning("No image provided in request")
        return jsonify({'error': 'No image provided'}), 400
    
    image = request.files['image']

    if image.filename == '':
        logger.warning("Empty filename in request")
        return jsonify({'error': 'No selected file'}), 400
    
    # Validate image file
    is_valid, error_msg = validate_image(image)
    if not is_valid:
        #logger.warning(f"Invalid image upload: {error_msg}")
        return jsonify({'error': error_msg}), 400
    
    try:
        # Sanitize filename
        safe_filename = secure_filename(image.filename)
        logger.info(f"Processing image: {safe_filename}")
        
        # Read the image file
        img = Image.open(BytesIO(image.read()))
        
        # Limit image dimensions to prevent DoS
        max_dimension = 4096
        if img.width > max_dimension or img.height > max_dimension:
            logger.warning(f"Image too large: {img.width}x{img.height}")
            return jsonify({'error': 'Image dimensions too large (max 4096px)'}), 400

        # Perform inference
        results = model.predict(source=img, conf=0.7, verbose=False)

        # Process results
        predictions = results[0].boxes

        # Prepare the response
        response = {
            'predictions': []
        }

        for box in predictions:
            response['predictions'].append({
                'class': model.names[int(box.cls)],
                'confidence': float(box.conf),
            })
        
        logger.info(f"Prediction successful: {len(predictions)} objects detected confidence: {list(zip([float(box.conf) for box in predictions], [model.names[int(box.cls)] for box in predictions]))}")
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None
    }), 200

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    logger.warning("File too large uploaded")
    return jsonify({'error': 'File too large (max 16MB)'}), 413

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded"""
    logger.warning(f"Rate limit exceeded: {get_remote_address()}")
    return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429

if __name__ == '__main__':
    # Production settings - use a production WSGI server like gunicorn
    app.run(host='0.0.0.0', port=5003, debug=False)