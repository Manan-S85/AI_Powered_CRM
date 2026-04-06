import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List

import requests
from dotenv import dotenv_values, load_dotenv


_PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_PROJECT_ROOT / ".env", override=True)
load_dotenv()


def _get_env(name: str, default: str = "") -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value

    env_file_values = dotenv_values(_PROJECT_ROOT / ".env")
    return str(env_file_values.get(name) or default).strip()


def _build_prompt(company: str, content: str) -> str:
    trimmed_content = (content or "").strip()
    if len(trimmed_content) > 8000:
        trimmed_content = trimmed_content[:8000]

    return (
        "You are a B2B company intelligence analyst.\n\n"
        "Analyze ONLY the provided website text for the company and return STRICT JSON.\n"
        "If data is missing or unclear, return \"Unknown\" for strings and [] for lists.\n"
        "Do not hallucinate executive names or roles.\n\n"
        f"Company Name: {company}\n"
        "Website Text:\n"
        f"\"\"\"\n{trimmed_content}\n\"\"\"\n\n"
        "Return JSON with EXACT keys:\n"
        "{\n"
        "  \"industry\": \"string\",\n"
        "  \"estimated_company_size\": \"string\",\n"
        "  \"decision_makers\": [\"string\"],\n"
        "  \"summary\": \"string\"\n"
        "}\n"
    )


def _sanitize_intelligence(parsed: Dict[str, Any], company: str) -> Dict[str, Any]:
    industry = str(parsed.get("industry", "Unknown")).strip() or "Unknown"
    size = str(parsed.get("estimated_company_size", "Unknown")).strip() or "Unknown"
    summary = str(parsed.get("summary", "")).strip()

    raw_decision_makers = parsed.get("decision_makers", [])
    if isinstance(raw_decision_makers, list):
        decision_makers = []
        seen = set()
        for item in raw_decision_makers:
            label = str(item).strip()
            if not label:
                continue
            key = label.lower()
            if key in seen:
                continue
            seen.add(key)
            decision_makers.append(label)
            if len(decision_makers) >= 8:
                break
    else:
        decision_makers = []

    if not summary:
        summary = f"No reliable company summary could be extracted for {company}."

    return {
        "industry": industry,
        "estimated_company_size": size,
        "decision_makers": decision_makers,
        "summary": summary,
    }


def _extract_json_from_text(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("LLM returned empty content")

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise


def _call_openai_for_company_intelligence(company: str, content: str) -> Dict[str, Any]:
    api_key = _get_env("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured")

    model_name = _get_env("OPENAI_LLM_MODEL", "gpt-4o-mini")
    prompt = _build_prompt(company, content)

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
        raise ValueError(f"OpenAI request failed: {response.status_code} {response.text}")

    payload = response.json()
    content_json = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
    parsed = _extract_json_from_text(content_json)
    return _sanitize_intelligence(parsed, company)


def _get_gemini_model_candidates() -> List[str]:
    configured = _get_env("GEMINI_MODEL")
    ordered = [
        configured,
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash-lite",
        "gemini-3.1-flash-preview",
        "gemini-2.5-flash",
        "gemini-1.5-flash",
    ]
    deduped: List[str] = []
    for model_name in ordered:
        if model_name and model_name not in deduped:
            deduped.append(model_name)
    return deduped


def _call_gemini_for_company_intelligence(company: str, content: str) -> Dict[str, Any]:
    api_key = _get_env("GEMINI_API_KEY") or _get_env("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY/GOOGLE_API_KEY is not configured")

    prompt = _build_prompt(company, content)
    last_error = ""

    for model_name in _get_gemini_model_candidates():
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        response = requests.post(
            endpoint,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                },
            },
            timeout=60,
        )

        if response.status_code >= 400:
            last_error = f"Gemini {model_name} failed: {response.status_code} {response.text}"
            if response.status_code in {404, 429, 503}:
                continue
            raise ValueError(last_error)

        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            last_error = f"Gemini {model_name} returned no candidates"
            continue

        text_output = ""
        for part in candidates[0].get("content", {}).get("parts", []):
            if isinstance(part, dict) and part.get("text"):
                text_output += str(part.get("text"))

        if not text_output.strip():
            last_error = f"Gemini {model_name} returned empty content"
            continue

        parsed = _extract_json_from_text(text_output)
        return _sanitize_intelligence(parsed, company)

    raise ValueError(last_error or "Gemini request failed")


def _infer_industry_from_content(content: str) -> str:
    text = (content or "").lower()
    if not text:
        return "Unknown"

    rules = [
        ("Software / SaaS", ["crm", "platform", "saas", "software", "cloud", "ai", "automation"]),
        ("IT Services", ["consulting", "implementation", "managed services", "integration services"]),
        ("Finance / Fintech", ["fintech", "payments", "banking", "financial"]),
        ("Healthcare", ["healthcare", "medical", "hospital", "clinic"]),
        ("Education", ["edtech", "learning", "education", "course"]),
        ("E-commerce / Retail", ["ecommerce", "retail", "shopping", "store"]),
    ]

    for label, keywords in rules:
        if any(keyword in text for keyword in keywords):
            return label
    return "Unknown"


def _infer_company_size(content: str) -> str:
    text = (content or "").lower()
    if not text:
        return "Unknown"

    employee_match = re.search(r"(\d{2,5})\s*\+?\s*(employees|team members|people)", text)
    if employee_match:
        try:
            count = int(employee_match.group(1))
        except ValueError:
            count = 0
        if count > 1000:
            return "1000+ employees"
        if count > 250:
            return "251-1000 employees"
        if count > 50:
            return "51-250 employees"
        if count > 0:
            return "1-50 employees"

    if "startup" in text:
        return "1-50 employees"
    if "enterprise" in text:
        return "251+ employees"

    return "Unknown"


def _infer_decision_makers(content: str) -> List[str]:
    text = (content or "")
    if not text.strip():
        return []

    # Infer by title mentions only; do not fabricate names.
    title_patterns = [
        ("CEO", r"\b(ceo|chief executive officer)\b"),
        ("CTO", r"\b(cto|chief technology officer)\b"),
        ("CIO", r"\b(cio|chief information officer)\b"),
        ("COO", r"\b(coo|chief operating officer)\b"),
        ("CFO", r"\b(cfo|chief financial officer)\b"),
        ("VP Engineering", r"\b(vp engineering|vice president of engineering)\b"),
        ("Head of Engineering", r"\b(head of engineering)\b"),
        ("Head of Sales", r"\b(head of sales)\b"),
        ("Head of Product", r"\b(head of product)\b"),
    ]

    lower = text.lower()
    detected = [label for label, pattern in title_patterns if re.search(pattern, lower)]
    return detected[:8]


def _fallback_company_intelligence(company: str, content: str, failure_reasons: List[str]) -> Dict[str, Any]:
    industry = _infer_industry_from_content(content)
    estimated_company_size = _infer_company_size(content)
    decision_makers = _infer_decision_makers(content)

    if content.strip():
        summary = (
            f"{company} website content was parsed, but LLM-based enrichment is currently unavailable. "
            f"Detected industry: {industry}."
        )
    else:
        summary = (
            f"No website content could be extracted for {company}. "
            "Provide a working website URL or additional company context."
        )

    if failure_reasons:
        summary = f"{summary} Last enrichment error: {failure_reasons[-1][:240]}"

    return {
        "industry": industry,
        "estimated_company_size": estimated_company_size,
        "decision_makers": decision_makers,
        "summary": summary,
    }


def _provider_order() -> List[str]:
    configured_provider = _get_env("LLM_PROVIDER").lower()
    gemini_key = _get_env("GEMINI_API_KEY") or _get_env("GOOGLE_API_KEY")
    openai_key = _get_env("OPENAI_API_KEY")

    if configured_provider == "gemini":
        return ["gemini", "openai"]
    if configured_provider == "openai":
        return ["openai", "gemini"]

    if gemini_key:
        return ["gemini", "openai"]
    if openai_key:
        return ["openai", "gemini"]
    return ["gemini", "openai"]


def generate_company_intelligence(company: str, content: str) -> Dict[str, Any]:
    errors: List[str] = []

    for provider in _provider_order():
        try:
            if provider == "gemini":
                result = _call_gemini_for_company_intelligence(company, content)
                result["provider_used"] = "gemini"
                return result
            if provider == "openai":
                result = _call_openai_for_company_intelligence(company, content)
                result["provider_used"] = "openai"
                return result
        except Exception as error:
            errors.append(f"{provider}: {error}")

    fallback = _fallback_company_intelligence(company, content, errors)
    fallback["provider_used"] = "fallback"
    fallback["provider_errors"] = errors
    return fallback


def generate_summary(company: str, content: str) -> str:
    """Backwards-compatible summary API used by legacy enrichment code."""
    intelligence = generate_company_intelligence(company, content)
    return intelligence.get("summary", "No summary generated.")