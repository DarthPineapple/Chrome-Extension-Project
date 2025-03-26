import re
from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup
from bs4.element import Comment

def get_base_url(url):
    parsed_url = urlparse(url)
    base_url = f"{parsed_url.scheme}\://{parsed_url.netloc}"
    return base_url

def combine_url(url, img):
    try:
        base_url = get_base_url(url)
        img_url = img.get('src')
        final_url = urljoin(base_url, img_url)
        return final_url
    except Exception as e:
        print(f"Error: {e}")
        return None
def clean_html(html, url):
    soup = BeautifulSoup(html, "html.parser")

    img_urls = []
    for img in soup.find_all("img"):
        try:
            if img.get("src"):
                img_urls.append(img.get("src"))
        except Exception as e:
            final_url = combine_url(url, img)
            if final_url:
                img_urls.append(final_url)
    for element in soup(text=lambda text:isinstance(text, Comment)):
        element.extract()

    for tag in soup(["script", "style", "header", "footer", "nav", "aside"]):
        tag.extract()

    text_content = soup.get_text(seperator = " ", strip = True)
    return text_content, img_urls

def clean_text(text):
    text = " ".join(text.split())
    text = re.sub(r'[^\x00-\x7F]+', '', text)
    text = re.sub(r'\[[0-9]+\]', '', text)
    return text