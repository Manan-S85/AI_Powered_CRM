"""Tool implementation for company enrichment."""

from __future__ import annotations

import importlib.util
import os
from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlparse



def _load_module(module_name: str, file_path: Path):
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load module from {file_path}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module



def _load_enrichment_functions():
    service_dir = Path(__file__).resolve().parents[2]
    enrichment_dir = service_dir / "lead data enrichment"

    if not enrichment_dir.exists():
        raise FileNotFoundError(f"Lead enrichment directory not found: {enrichment_dir}")

    ai_processor = _load_module("chatbot_lead_ai_processor", enrichment_dir / "ai_processor.py")
    domain_extractor = _load_module("chatbot_domain_extractor", enrichment_dir / "domain_extractor.py")
    website_scraper = _load_module("chatbot_website_scraper", enrichment_dir / "website_scraper.py")

    return {
        "generate_company_intelligence": getattr(ai_processor, "generate_company_intelligence"),
        "extract_domain": getattr(domain_extractor, "extract_domain"),
        "scrape_website": getattr(website_scraper, "scrape_website"),
    }


def _normalize_website_url(url: str) -> str:
    normalized = (url or "").strip()
    if not normalized:
        return ""

    if not normalized.startswith(("http://", "https://")):
        normalized = f"https://{normalized}"

    return normalized


def _normalize_domain(domain: str) -> str:
    normalized = (domain or "").strip().lower()
    if not normalized:
        return ""

    # Accept full URL or domain and normalize to host only.
    parsed = urlparse(normalized if "://" in normalized else f"https://{normalized}")
    host = parsed.netloc or parsed.path
    host = host.split(":", 1)[0].strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _assess_enrichment_quality(intelligence: Dict[str, Any], website_content: str) -> str:
    industry = str(intelligence.get("industry") or "").strip().lower()
    size = str(intelligence.get("estimated_company_size") or "").strip().lower()
    summary = str(intelligence.get("summary") or "").strip().lower()
    decision_makers = intelligence.get("decision_makers")

    has_industry = industry and industry != "unknown"
    has_size = size and size != "unknown"
    has_summary = bool(summary) and "fallback" not in summary
    has_decision_makers = isinstance(decision_makers, list) and len([x for x in decision_makers if str(x).strip()]) > 0
    has_site_text = len((website_content or "").strip()) >= 200

    score = sum([has_industry, has_size, has_summary, has_decision_makers, has_site_text])
    if score >= 4:
        return "high"
    if score >= 2:
        return "medium"
    return "low"



def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
    company_name = str(arguments["company_name"]).strip()
    company_website = _normalize_website_url(str(arguments.get("company_website") or ""))
    company_email = str(arguments.get("company_email") or "").strip()

    if not company_name:
        raise ValueError("company_name is required")

    modules = _load_enrichment_functions()

    domain = modules["extract_domain"](company_email, company_website)
    normalized_domain = _normalize_domain(str(domain or ""))
    website_content = modules["scrape_website"](company_website) if company_website else ""
    intelligence = modules["generate_company_intelligence"](company_name, website_content)
    enrichment_quality = _assess_enrichment_quality(intelligence, website_content)

    if enrichment_quality == "high":
        recommendations = [
            "Prioritize outreach to identified decision makers.",
            "Use summary insights to tailor your first contact message.",
        ]
    elif enrichment_quality == "medium":
        recommendations = [
            "Validate budget owner and buying committee in discovery.",
            "Collect more context from recent company updates before outreach.",
        ]
    else:
        recommendations = [
            "Provide a company LinkedIn or About page URL for stronger enrichment.",
        ]
        has_llm_key = bool(
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("OPENAI_API_KEY")
        )
        if has_llm_key:
            recommendations.append(
                "Website appears JS-heavy; add a text-rich page URL (About/Services) to improve accuracy."
            )
        else:
            recommendations.append(
                "Configure GEMINI_API_KEY (or OPENAI_API_KEY) for deeper AI enrichment."
            )

    return {
        "company": company_name,
        "domain": normalized_domain or domain,
        "website": company_website or None,
        "website_content_chars": len((website_content or "").strip()),
        "enrichment_quality": enrichment_quality,
        "recommendations": recommendations,
        "intelligence": intelligence,
    }
