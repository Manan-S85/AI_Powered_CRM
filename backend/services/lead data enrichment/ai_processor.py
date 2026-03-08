import json
import os
from typing import Any, Dict

import requests


def _fallback_company_intelligence(company: str, content: str) -> Dict[str, Any]:
    """Return deterministic enrichment output when AI APIs are unavailable."""
    summary = (
        f"{company} appears to be an active organization. "
        "Run enrichment again with OPENAI_API_KEY configured for deeper intelligence."
    )

    if content:
        summary = (
            f"{company} has public website content available. "
            "AI enrichment fallback was used, so this is a basic summary only."
        )

    return {
        "industry": "Unknown",
        "estimated_company_size": "Unknown",
        "decision_makers": ["CTO", "Head of Engineering"],
        "summary": summary,
    }


def _call_openai_for_company_intelligence(company: str, content: str) -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    model_name = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
    prompt = f"""
Company Name: {company}
Website Content: {content}

Return STRICT JSON only with this schema:
{{
  "industry": "string",
  "estimated_company_size": "string",
  "decision_makers": ["string"],
  "summary": "string"
}}
"""

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "Return strict JSON output only."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )

    if response.status_code >= 400:
        raise ValueError(f"OpenAI request failed: {response.text}")

    payload = response.json()
    content_json = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not content_json:
        raise ValueError("OpenAI returned empty content")

    parsed = json.loads(content_json)
    return {
        "industry": str(parsed.get("industry", "Unknown")).strip() or "Unknown",
        "estimated_company_size": str(parsed.get("estimated_company_size", "Unknown")).strip() or "Unknown",
        "decision_makers": parsed.get("decision_makers", []) if isinstance(parsed.get("decision_makers", []), list) else [],
        "summary": str(parsed.get("summary", "")).strip() or "No summary generated.",
    }


def generate_company_intelligence(company: str, content: str) -> Dict[str, Any]:
    try:
        return _call_openai_for_company_intelligence(company, content)
    except Exception:
        return _fallback_company_intelligence(company, content)


def generate_summary(company: str, content: str) -> str:
    """Backwards-compatible summary API used by legacy enrichment code."""
    intelligence = generate_company_intelligence(company, content)
    return intelligence.get("summary", "No summary generated.")