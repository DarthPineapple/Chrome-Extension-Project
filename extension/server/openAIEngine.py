import json
import os
from openai import OpenAI
import base64



#with open('/Users/skychen/Documents/openAIproject/learning/webScraper/flask_server.py', 'r') as file:
#key = json.load(file)

with open("key.json", 'r') as file:
    api_key = os.environ.get("OPENAI_API_KEY")
    client = OpenAI(api_key)


def predict_image(img_url):
    '''prompt = """Analyze the provided image and determine if it should be censored based on the following criteria:
    If the image contains violence, nudity, hate speech, or other inappropriate material, it shouls be defines as "bad".
    If the image is safe and suitable for all audiences, it shouls be classified as "good".
    Return your response in the following JSON format:
    {
        "prediction": "<good/bad>"
    }
        """'''
    #image_payload = {"url": img_url}
    prompt = """
    Analyze the provided image and determine if it should be censored based on the following criteria.
    Classify it into one of the categories:
    - "drugs"
    - "explicit"
    - "gambling"
    - "profanity"
    - "social media"
    - "violence"
    If the image belongs to one of these categories, return the category name along with a confidence score. If it does not fit any category, classify it as "unknown" and return the cassification along with a confidence score.

    Return using the following JSON format:
    {
        "class": "<drugs|explicit|gambling|profanity|social-media|violence>"
        "confidence": <float>
    }

    """
    response = client.chat.completions.create(
        model="gpt-4o", 
        messages=[
            {"role": "user", 
             "content": [
                 {
                    "type":"text",
                    "text": prompt
                 },
                 {
                     "type": "image_url",
                     "image_url": {
                         "url": img_url
                         }
                 }
             ]}],
             response_format = {"type": "json_object"}
    )
    # Extracting OpenAI's response
    message = response.choices[0].message.content
    #message = json.load(message)
    return message
def predict_text(text):
    '''prompt = """Analyze the provided text and determine if it should be censored based on the following criteria:
    If the text contains violence, nudity, hate speech, or other inappropriate material, it shouls be defines as "bad".
    If the text is safe and suitable for all audiences, it shouls be classified as "good".
    Return your response in the following JSON format:
    {
        "prediction": "<good/bad>"
    }
        """'''
    prompt = """
    Analyze the provided text and determine if it should be censored based on the following criteria.
    Classify it into one of the categories:
    - "drugs"
    - "explicit"
    - "gambling"
    - "profanity"
    - "social media"
    - "violence"
    If the text belongs to one of these categories, return the category name along with a confidence score. If it does not fit any category, classify it as "unknown" and return the cassification along with a confidence score.

    Return using the following JSON format:
    {
        "class": "<drugs|explicit|gambling|profanity|social-media|violence>"
        "confidence": <float>
    }
    """
    response = client.chat.completions.create(
        model="gpt-4o-mini", 
        messages=[
            {"role": "user", 
             "content": [
                 {
                    "type":"text",
                    "text": prompt
                 },
                 {
                     "type": "text",
                     "text": text
                 }
             ]}],
             response_format = {"type": "json_object"}
    )
    message = response.choices[0].message.content
    #message = json.load(message)
    return message
if __name__ == "__main__":
    print(predict_text("""I like playing poker and betting all my money."""))
    print(predict_image('https://s.abcnews.com/images/International/barcelona-04-as-gty-191019_hpMain_16x9_992.jpg?w=992'))
    print(predict_image("https://upload.wikimedia.org/wikipedia/en/thumb/b/bc/Garfield_the_Cat.svg/500px-Garfield_the_Cat.svg.png"))