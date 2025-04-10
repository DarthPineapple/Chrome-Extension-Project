import requests 
from bs4 import BeautifulSoup as BS
import re

url = 'https://store.steampowered.com/app/2399830/ARK_Survival_Ascended/'
page = requests.get(url)
soup = BS(page.text, "html.parser")
html = page.text

#print(soup.find_all('div', class_='game_purchase_price price'))
#print(soup.find_all('div', class_='game_purchase_price price')[0])
#[\d]{16}
print('extracting data with bs4')
print('Price: ', soup.find_all('div', class_='game_purchase_price price')[0].text.strip())
print('Name: ', soup.find_all('div', class_='apphub_AppName')[0].text.strip())
print('Release Date: ', soup.find_all('div', class_='date')[0].text.strip())
print('User Reviews: ', soup.find_all('span', class_=re.compile('game_review_summary [a-z]+'))[0].text.strip())
