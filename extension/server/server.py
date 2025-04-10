from flask import Flask, request, jsonify
#import requests
import base64
import mimetypes

from openAIEngine import predict_image, predict_text
#from utils.cleanup import clean_html
#from utils.wikifetcher import get_wiki_summary

app = Flask(__name__)

@app.route('/')
def index():
    return "Welcome to Child Safety AI Engine"

@app.route('/api/predict/image', methods = ['POST'])
def fetch_predict_image():
    # Checks if image is sent over server
    if not "image" in request.files:
        return jsonify({"error": "No image part"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No selected image"}), 400
    
    try:
        image_bytes = file.read()
        img_b64_str = base64.b64encode(image_bytes).decode("utf-8")

        img_type = mimetypes.guess_type(file.filename)[0] or "applicaion/octet-stream"
        image_url = f"data:{img_type};base64,{img_b64_str}"
        prediction = predict_image(image_url)

        return jsonify({
            "predictions": [prediction]
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to process image:{str(e)}"}), 500

@app.route('/api/predict/text', methods = ['POST'])
def fetch_predict_text():
    #check to see if text was sent over
    if not "text" in request.form:
        return jsonify({"error": "No text part"}), 400
    text = request.form["text"]
    try:
        prediction = predict_text(text)
        return jsonify(prediction), 200
    except Exception as e:
        return jsonify({"error": f"Failed to process image:{str(e)}"}), 500

"""@app.route("/api/process_url", methods=["POST"])
def process_url():
    data = request.json
    url = data["url"]

    if "wikipedia" in url:
        text = get_wiki_summary(url)
        result = predict_text(text[:100])
        prediction = result["prediction"]
    else:
        try:
            response = requests.get(url, headers = {
                'User-Agent': 'Mozilla/5.0, (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            })
            html = response.text
        except Exception as e:
            return jsonify({f"error": "Error"})
        text, image_urls = clean_html(html, url)
        prediction = predict_text(text[:100])

        if prediction["prediction"] == "good":
            prediction = predict_image(image_urls[0])

    return jsonify(prediction)

@app.route("/api/html/query", methods = ["POST"])
def html_query():
    data = requests.json
    url = data.get('url')
    if not url:
        return jsonify({'status': 'error', 
                        'message': 'No URL Provided'}), 400
    try:
        response = requests.get(url, headers = {
            'User-Agent': 'Mozilla/5.0, (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        })
        html = response.text
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Coult not fetch the URL"
        }), 400
    text, image_urls = clean_html(html, url)
    predictionText = predict_text(text)
    censoredImages = [image for image in image_urls if predict_image(image)["prediction"] == "bad"]
    censoredText = [sentence for sentence in text.split('. ') if predict_text(sentence)["prediction"] == "bad"]

    return jsonify({
        'status': "success",
        'sentences': censoredText,
        'images': censoredImages
    })"""

if __name__ == "__main__":
    app.run(host = "0.0.0.0", port = "8080")