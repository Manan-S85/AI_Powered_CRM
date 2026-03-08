import re

import requests


def _strip_html_tags(raw_html: str) -> str:
    """Best-effort HTML to text fallback when BeautifulSoup is unavailable."""
    no_script = re.sub(r"<script[\\s\\S]*?</script>", " ", raw_html, flags=re.IGNORECASE)
    no_style = re.sub(r"<style[\\s\\S]*?</style>", " ", no_script, flags=re.IGNORECASE)
    no_tags = re.sub(r"<[^>]+>", " ", no_style)
    return re.sub(r"\\s+", " ", no_tags).strip()

def scrape_website(url):
    try:
        response = requests.get(url, timeout=5)
        html = response.text

        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, "html.parser")
            text = soup.get_text(separator=" ", strip=True)
        except Exception:
            text = _strip_html_tags(html)

        return text[:3000]
    except Exception:
        return ""