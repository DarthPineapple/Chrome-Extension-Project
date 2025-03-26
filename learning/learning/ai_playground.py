import openai as OpenAI


def chat(prompt, model = 'gpt-3.5-turbo'):
    response = openai.chat.completions.create(
        model=model, 
        messages=[{"role": "system", "content": "You are a helpful assistant."}, 
        {"role": "user", "content": prompt}], 
        max_tokens=100, temperature=0.5 ) # Extracting the assistant's response 
    message = response['choices'][0]['message']['content'].strip() 
    return message

print(chat('Write a summary of LOTR'))
