import requests
from bs4 import BeautifulSoup as bs
import re

response = requests.get("https://www.cdc.gov/coronavirus/2019-ncov")

soup = bs(response.content, "html.parser")
#print(soup.prettify())
div_list = soup.findAll('div', attrs={'class':'panel'})
image = soup.findAll('img')

for div in image:
    img = div.find('img')
    print(img['src'])