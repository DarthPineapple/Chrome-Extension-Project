from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
from PIL import Image
from io import BytesIO

# Initialize the Flask app
app = Flask(__name__)
CORS(app)

# Load the YOLOv8 model
model = YOLO("yolov8n.pt")  # Load the YOLOv8 model (you can specify a different model if needed)

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    image = request.files['image']

    if image.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    try:
        # Read the image file
        img = Image.open(BytesIO(image.read()))

        # Perform inference
        results = model.predict(source=img, conf=0.7)

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

        return jsonify(response), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003)