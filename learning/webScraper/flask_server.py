from flask import Flask, jsonify
from flask_cors import CORS
import random
import json
import requests
import re

app = Flask(__name__)
CORS(app)

#img = requests.get('https://store.fastly.steamstatic.com/public/shared/images/responsive/header_menu_hamburger.png')
text = requests.get('https://scarsdaleschools.org/').text
'''text = re.sub('[\'|\"]/', 'https://scarsdaleschools.org/', text)
text = text.replace(b'/includes/images', b'https://scarsdaleschools.org/images')
text = text.replace(b'/includes/css', b'https://scarsdaleschools.org/css')
text = text.replace(b'/includes/js', b'https://scarsdaleschools.org/js')'''

@app.route("/")
def do_stuff():
    #return img.content
    return text
    #return f'<h1>{random.randint(1, 100)}</h1>'

'''def get_score():
    score = random.randint(1, 100)
    return json.dumps(score)'''

if __name__ == '__main__':
    app.run(host = '0.0.0.0', port='0924')