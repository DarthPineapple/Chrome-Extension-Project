import requests

def main():
    url = "http://localhost:5000/predict_text"
    print("Enter text to analyze (type 'exit' to quit):")
    while True:
        user_input = input("> ")
        if user_input.lower().strip() == '' or user_input.lower() == 'exit':
            break

        response = requests.post(url, json={"text": [user_input]})

        if response.status_code == 200:
            result = response.json()
            print("Response:", result)
        else:
            print("Error:", response.status_code, response.text)

if __name__ == "__main__":
    main()