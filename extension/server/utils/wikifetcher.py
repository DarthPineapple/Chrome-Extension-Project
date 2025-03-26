import wikipediaapi

email = "siqianskychen@gmail.com"

def get_wiki_summary(url):
    title = url.split("/wiki/")[-1]
    wiki_wiki = wikipediaapi.Wikipedia(f'Safenet/1.0 ({email})', 'de')

    page = wiki_wiki.page(title)

    if not page.exists():
        return "Page does not exist"
    
    return page.summary

if __name__ == "__main__":
    url = "https://en.wikipedia.org/wiki/Wikipedia"
    print(get_wiki_summary(url))