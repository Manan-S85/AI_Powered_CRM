import requests
from bs4 import BeautifulSoup

def scrape_website(url):
    try:
        response = requests.get(url, timeout=5)
        soup = BeautifulSoup(response.text, "html.parser")
        text = soup.get_text(separator=" ", strip=True)
        return text[:3000]
    except:
        return ""