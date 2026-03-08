from urllib.parse import urlparse

def extract_domain(email, website):
    if website:
        parsed = urlparse(website)
        return parsed.netloc

    if email:
        return email.split("@")[1]

    return None