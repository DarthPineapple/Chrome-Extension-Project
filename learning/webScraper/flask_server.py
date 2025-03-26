from flask import Flask, jsonify
from flask_cors import CORS
import random
import json
import requests

app = Flask(__name__)
CORS(app)
text = requests.get('https://www.google.com').text

@app.route("/")
def do_stuff():
    return text

'''def get_score():
    score = random.randint(1, 100)
    return json.dumps(score)'''

if __name__ == '__main__':
    app.run(host = '0.0.0.0', port='8080')