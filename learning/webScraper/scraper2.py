import requests 
from bs4 import BeautifulSoup as BS
import re

'''url = 'https://store.steampowered.com/app/2399830/ARK_Survival_Ascended/'
page = requests.get(url)
soup = BS(page.text, "html.parser")

#print(soup.find_all('div', class_='game_purchase_price price'))
#print(soup.find_all('div', class_='game_purchase_price price')[0])
print('Price: ', soup.find_all('div', class_='game_purchase_price price')[0].text.strip())
print('Name: ', soup.find_all('div', class_='apphub_AppName')[0].text.strip())
print('Release Date: ', soup.find_all('div', class_='date')[0].text.strip())
print('User Reviews: ', soup.find_all('span', class_='game_review_summary mixed')[0].text.strip())'''
list_stocks = [
    {
        'name' : 'Nvidia',
        'target' : 1230,
        'url' : 'https://finance.yahoo.com/quote/NVDA?p=NVDA',
        'price' : 0,
        'buy' : False
    },
    {
        'name' : 'Apple',
        'target' : 2330,
        'url' : 'https://finance.yahoo.com/quote/AAPL?p=AAPL',
        'price' : 0,
        'buy' : False
    }
]

for stock in list_stocks:
    headers = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:66.0) Gecko/20100101 Firefox/66.0", "Accept-Encoding":"gzip, deflate","Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "DNT":"1","Connection":"close", "Upgrade-Insecure-Requests":"1"}
    page = requests.get(stock['url'])#, headers = headers)

    soup = BS(page.text, 'html.parser')
    res = soup.findall('span', class_ = 'base    yf-ipw1h0')
    price = float(res[0].text.replace(',', ''))
    stock['price'] = price
    print(stock['name'], price, price < stock['target'])
    stock['buy'] = price < stock['target']

print(list_stocks)