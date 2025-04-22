from selenium import webdriver
from selenium.webdriver.common.by import By
import openai
import re

chatgpt = openai.OpenAI(api_key = '')

def grabQuestion():
    div = driver.find_elements(By.XPATH, "//div[contains(@class, '_regularBody_')]")[-1]
    answers = div.find_elements(By.XPATH, ".//div[contains(@class, '_answerText_')]")
    image = div.find_elements(By.XPATH, ".//img[contains(@class, '_image_')]")
    question = driver.find_element(By.XPATH, ".//div[contains(@class, '_questionText_')]")
    return {'answers': answers, 'question': question, 'image': image}

def answerQuestion():
    question = grabQuestion()
    q = question['question'].text
    a = [i.text for i in question['answers']]
    prompt = [{'type': 'text', 'text': i.text} for i in question['answers']]
    img = question['image']
    if img:
        print('Image Detected')
        img = img[-1]
        url = img.get_attribute('src')
        if (q, url) in seen:
            ans = seen[(q, url)]
            question['answers'][a.index(ans)].click()
            return ans
        result = chatgpt.chat.completions.create(model="gpt-4o",
                                        messages=[
                                            {
                                                'role': "user",
                                                'content': [
                                                    {'type': 'text', 'text': 'Analyze the given question and image and choose the answer that best fits the given question. Show your thought process and give your response at the end as the probability of each choice being correct in the form [a, b, c, d] with a, b, c, and d being numbers.'},
                                                    {'type': 'text', 'text': 'question:'},
                                                    {'type': 'text', 'text': q},
                                                    {'type': 'text', 'text': 'image:'},
                                                    {'type': 'image_url', 'image_url': {'url': url}},
                                                    {'type': 'text', 'text': 'answer choices: '}
                                                ] + prompt
                                            }
                                        ])
        print(result.choices[0].message.content)
        gptAns = list(pattern.finditer(result.choices[0].message.content))[-1].groups()
        gptAns = gptAns.index(max(gptAns))
        print(gptAns)
        question['answers'][gptAns].click()
        seen[(q, url)] = a[gptAns]
        return seen[(q, url)]
    
    if q in seen:
        ans = seen[q]
        question['answers'][a.index(ans)].click()
        return ans
    result = chatgpt.chat.completions.create(model="gpt-4o",
                                    messages=[
                                        {
                                            'role': "user",
                                            'content': [
                                                {'type': 'text', 'text': 'Analyze the given question and choose the answer that best fits the given question. Show your thought process and give your response at the end as the probability of each choice being correct in the form [a, b, c, d] with a, b, c, and d being numbers.'},
                                                {'type': 'text', 'text': 'question:'},
                                                {'type': 'text', 'text': q},
                                                {'type': 'text', 'text': 'answer choices:'}
                                            ] + prompt
                                        }
                                    ])
    print(result.choices[0].message.content)
    gptAns = list(pattern.finditer(result.choices[0].message.content))[-1].groups()
    gptAns = gptAns.index(max(gptAns))
    question['answers'][gptAns].click()
    seen[q] = a[gptAns]
    return seen[q]

#initiate browser
driver = webdriver.Firefox()
driver.get("https://www.blooket.com/play")
seen = {}
pattern = re.compile(
    r'\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]'
)
