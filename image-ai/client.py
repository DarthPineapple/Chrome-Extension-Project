import requests

if __name__ == "__main__":
    url = "http://localhost:5003/predict"
    image_path = "test.jpg"
    with open(image_path, "rb") as image_file:
        files = {"image": image_file}
        response = requests.post(url, files=files)

    if response.status_code == 200:
        result = response.json()
        for prediction in result["predictions"]:
            print(f"Class: {prediction['class']} - Confidence: {prediction['confidence']}")