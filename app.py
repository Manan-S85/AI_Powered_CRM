from flask import Flask, request, jsonify
from services.domain_extractor import extract_domain
from services.website_scraper import scrape_website
from services.ai_processor import generate_summary
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