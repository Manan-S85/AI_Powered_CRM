"""Tool implementation for company enrichment."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Dict



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



def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
    company_name = str(arguments["company_name"]).strip()
    company_website = str(arguments.get("company_website") or "").strip()
    company_email = str(arguments.get("company_email") or "").strip()

    if not company_name:
        raise ValueError("company_name is required")

    modules = _load_enrichment_functions()

    domain = modules["extract_domain"](company_email, company_website)
    website_content = modules["scrape_website"](company_website) if company_website else ""
    intelligence = modules["generate_company_intelligence"](company_name, website_content)

    return {
        "company": company_name,
        "domain": domain,
        "intelligence": intelligence,
    }
