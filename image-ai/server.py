from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import torch
from PIL import Image, ImageSequence
from io import BytesIO
import logging
from werkzeug.utils import secure_filename

try:
    import cairosvg
    SVG_SUPPORT_AVAILABLE = True
    SVG_SUPPORT_ERROR = None
except Exception as exc:
    cairosvg = None
    SVG_SUPPORT_AVAILABLE = False
    SVG_SUPPORT_ERROR = str(exc)

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


# Security configurations
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'}
ALLOWED_MIME_TYPES = {
    'image/png', 'image/jpeg', 'image/jpg', 
    'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml', 'image/svg'
}
MAX_DIMENSION = 4096
MAX_GIF_FRAMES = 8
GIF_FRAME_STEP = 2

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

def is_svg_upload(file):
    extension = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    return file.content_type in {'image/svg+xml', 'image/svg'} or extension == 'svg'

def validate_image(file, image_bytes):
    """Validate image file type and content."""
    # Check MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        return False, f"Invalid file type. {file.content_type} is not supported."
    
    # Check file extension
    if not allowed_file(file.filename):
        return False, "Invalid file extension"

    try:
        if is_svg_upload(file):
            if not SVG_SUPPORT_AVAILABLE:
                return False, 'SVG support is unavailable because CairoSVG/Cairo is not installed correctly on this machine.'
            cairosvg.svg2png(bytestring=image_bytes)
            return True, None

        img = Image.open(BytesIO(image_bytes))
        img.verify()
        return True, None
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

def enforce_dimensions(width, height):
    if width > MAX_DIMENSION or height > MAX_DIMENSION:
        raise ValueError(f'Image dimensions too large (max {MAX_DIMENSION}px)')

def rasterize_svg(image_bytes):
    if not SVG_SUPPORT_AVAILABLE:
        raise ValueError('SVG support is unavailable because CairoSVG/Cairo is not installed correctly on this machine.')
    png_bytes = cairosvg.svg2png(
        bytestring=image_bytes,
        output_width=MAX_DIMENSION,
        output_height=MAX_DIMENSION
    )
    img = Image.open(BytesIO(png_bytes)).convert('RGB')
    enforce_dimensions(img.width, img.height)
    return [img]

def sample_gif_frames(image_bytes):
    frames = []
    with Image.open(BytesIO(image_bytes)) as gif:
        for frame_index, frame in enumerate(ImageSequence.Iterator(gif)):
            if frame_index % GIF_FRAME_STEP != 0:
                continue
            rgb_frame = frame.convert('RGB')
            enforce_dimensions(rgb_frame.width, rgb_frame.height)
            frames.append(rgb_frame)
            if len(frames) >= MAX_GIF_FRAMES:
                break

    if not frames:
        raise ValueError('GIF did not contain any usable frames')
    return frames

def load_images_for_inference(file, image_bytes):
    if is_svg_upload(file):
        return rasterize_svg(image_bytes)

    with Image.open(BytesIO(image_bytes)) as img:
        if getattr(img, 'is_animated', False):
            return sample_gif_frames(image_bytes)

        rgb_image = img.convert('RGB')
        enforce_dimensions(rgb_image.width, rgb_image.height)
        return [rgb_image]

def run_model_on_images(images):
    predictions_by_class = {}

    device = 0 if torch.cuda.is_available() else 'cpu'
    print(f"Running model on device: {device}")

    for img in images:
        results = model.predict(
            source=img,
            conf=0.7,
            verbose=False,
            device=device
        )
        for box in results[0].boxes:
            class_name = model.names[int(box.cls)]
            confidence = float(box.conf)
            current_best = predictions_by_class.get(class_name)
            if current_best is None or confidence > current_best['confidence']:
                predictions_by_class[class_name] = {
                    'class': class_name,
                    'confidence': confidence
                }

    return sorted(predictions_by_class.values(), key=lambda item: item['confidence'], reverse=True)

@app.route('/predict_image', methods=['POST'])
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
    image_bytes = image.read()

    if image.filename == '':
        logger.warning("Empty filename in request")
        return jsonify({'error': 'No selected file'}), 400
    
    # Validate image file
    is_valid, error_msg = validate_image(image, image_bytes)
    if not is_valid:
        #logger.warning(f"Invalid image upload: {error_msg}")
        return jsonify({'error': error_msg}), 400
    
    try:
        # Sanitize filename
        safe_filename = secure_filename(image.filename)
        logger.info(f"Processing image: {safe_filename}")
        
        images = load_images_for_inference(image, image_bytes)
        predictions = run_model_on_images(images)

        # Prepare the response
        response = {
            'predictions': predictions
        }
        
        logger.info(
            "Prediction successful: %s classes detected %s",
            len(predictions),
            [(prediction['confidence'], prediction['class']) for prediction in predictions]
        )
        return jsonify(response), 200
    except ValueError as e:
        logger.warning("Image rejected: %s", e)
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'svg_support': SVG_SUPPORT_AVAILABLE,
        'svg_error': SVG_SUPPORT_ERROR
    }), 200

@app.errorhandler(413)
def request_entity_too_large(error):
    """Handle file too large error"""
    logger.warning("File too large uploaded")
    return jsonify({'error': 'File too large (max 16MB)'}), 413

if __name__ == '__main__':
    # Production settings - use a production WSGI server like gunicorn
    app.run(host='0.0.0.0', port=5003, debug=False)
