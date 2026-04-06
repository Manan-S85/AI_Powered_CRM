import re

import requests


def _strip_html_tags(raw_html: str) -> str:
    """Best-effort HTML to text fallback when BeautifulSoup is unavailable."""
    no_script = re.sub(r"<script[\\s\\S]*?</script>", " ", raw_html, flags=re.IGNORECASE)
    no_style = re.sub(r"<style[\\s\\S]*?</style>", " ", no_script, flags=re.IGNORECASE)
    no_tags = re.sub(r"<[^>]+>", " ", no_style)
    return re.sub(r"\\s+", " ", no_tags).strip()


def _extract_meta_content(raw_html: str) -> str:
    """Extract SEO metadata for SPA websites with little visible server-rendered text."""
    patterns = [
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']keywords["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']',
        r'<meta[^>]+name=["\']twitter:description["\'][^>]+content=["\']([^"\']+)["\']',
        r'<title[^>]*>([\s\S]*?)</title>',
    ]

    chunks = []
    for pattern in patterns:
        matches = re.findall(pattern, raw_html, flags=re.IGNORECASE)
        for match in matches:
            value = re.sub(r"\s+", " ", str(match)).strip()
            if value:
                chunks.append(value)

    # Include JSON-LD content; often contains organization profile and founders.
    json_ld_blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        raw_html,
        flags=re.IGNORECASE,
    )
    for block in json_ld_blocks:
        text = re.sub(r"\s+", " ", block).strip()
        if text:
            chunks.append(text)

    deduped = []
    seen = set()
    for chunk in chunks:
        key = chunk.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(chunk)

    return " ".join(deduped).strip()


def _extract_with_bs4(raw_html: str) -> str:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(raw_html, "html.parser")

    chunks = []

    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    if title:
        chunks.append(title)

    for tag in soup.find_all("meta"):
        content = (tag.get("content") or "").strip()
        name = (tag.get("name") or tag.get("property") or "").strip().lower()
        if not content:
            continue
        if name in {
            "description",
            "keywords",
            "og:title",
            "og:description",
            "twitter:title",
            "twitter:description",
            "author",
        }:
            chunks.append(content)

    for script_tag in soup.find_all("script", {"type": "application/ld+json"}):
        content = (script_tag.string or script_tag.get_text() or "").strip()
        if content:
            chunks.append(content)

    body_text = soup.get_text(separator=" ", strip=True)
    if body_text:
        chunks.append(body_text)

    deduped = []
    seen = set()
    for chunk in chunks:
        cleaned = re.sub(r"\s+", " ", chunk).strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cleaned)

    return " ".join(deduped).strip()


def _try_fetch_text(url: str) -> str:
    response = requests.get(
        url,
        timeout=10,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    html = response.text or ""

    try:
        text = _extract_with_bs4(html)
    except Exception:
        text = _extract_meta_content(html)
        if not text:
            text = _strip_html_tags(html)

    return text.strip()

def scrape_website(url):
    try:
        primary_url = (url or "").strip()
        if not primary_url:
            return ""

        text = _try_fetch_text(primary_url)

        # Try alternate host style when content is too short.
        if len(text) < 180:
            if "www." in primary_url:
                alternate = primary_url.replace("www.", "", 1)
            elif "://" in primary_url:
                scheme, rest = primary_url.split("://", 1)
                alternate = f"{scheme}://www.{rest}"
            else:
                alternate = primary_url

            if alternate != primary_url:
                alt_text = _try_fetch_text(alternate)
                if len(alt_text) > len(text):
                    text = alt_text

        return text[:6000]
    except Exception:
        return ""