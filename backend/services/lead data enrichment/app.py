from flask import Flask, request, jsonify
import sys
from pathlib import Path

# Ensure local module imports keep working after folder reorganization.
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent.parent

for candidate in (CURRENT_DIR, BACKEND_DIR):
    candidate_str = str(candidate)
    if candidate_str not in sys.path:
        sys.path.append(candidate_str)

from domain_extractor import extract_domain
from website_scraper import scrape_website
from ai_processor import generate_summary
from utils.validator import validate_input

app = Flask(__name__)

@app.route("/enrich-lead", methods=["POST"])
def enrich_lead():
    data = request.json

    company = data.get("company_name")
    website = data.get("website")
    email = data.get("email")

    if not validate_input(company, website, email):
        return jsonify({"error": "Invalid input"}), 400

    domain = extract_domain(email, website)

    content = ""
    if website:
        content = scrape_website(website)

    analysis = generate_summary(company, content)

    result = {
        "company": company,
        "domain": domain,
        "analysis": analysis
    }

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)