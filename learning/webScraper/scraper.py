import requests
from bs4 import BeautifulSoup as bs
import re

response = requests.get("https://store.steampowered.com/app/730/CounterStrike_2/")
#print(response.content)
soup = bs(response.content, "html.parser")
#print(soup.prettify())
image = soup.findAll('img')

for div in image:
    print(div['src'])