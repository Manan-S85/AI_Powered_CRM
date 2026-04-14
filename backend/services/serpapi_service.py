from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Dict, List

import requests
from dotenv import dotenv_values, load_dotenv

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_PROJECT_ROOT / ".env", override=True)
load_dotenv()

_SERPAPI_ENDPOINT = "https://serpapi.com/search.json"


def _get_env(name: str, default: str = "") -> str:
    value = os.getenv(name, "").strip()
    if value:
        return value

    env_file_values = dotenv_values(_PROJECT_ROOT / ".env")
    return str(env_file_values.get(name) or default).strip()


def get_serpapi_key() -> str:
    for env_name in ["SERPAPI_API_KEY", "SERP_API_KEY", "SERPAPI_KEY"]:
        candidate = _get_env(env_name)
        if candidate:
            return candidate
    return ""


def _normalize_organic_result(item: Dict[str, Any]) -> Dict[str, str]:
    return {
        "title": str(item.get("title") or "").strip(),
        "snippet": str(item.get("snippet") or item.get("snippet_highlighted_words") or "").strip(),
        "link": str(item.get("link") or "").strip(),
        "website": str(item.get("link") or "").strip(),
        "phone": "",
        "email": "",
        "address": "",
        "contact_person": "",
        "industry": "",
        "source_type": "organic",
    }


def _normalize_local_result(item: Dict[str, Any]) -> Dict[str, str]:
    title = str(item.get("title") or "").strip()
    description = str(item.get("description") or "").strip()
    address = str(item.get("address") or "").strip()
    place_type = str(item.get("type") or "").strip()

    snippet_parts = [part for part in [description, place_type, address] if part]
    return {
        "title": title,
        "snippet": " | ".join(snippet_parts),
        "link": str(item.get("website") or item.get("place_id_search") or "").strip(),
        "website": str(item.get("website") or "").strip(),
        "phone": str(item.get("phone") or item.get("phone_number") or "").strip(),
        "email": "",
        "address": address,
        "contact_person": "",
        "industry": place_type,
        "source_type": "local",
    }


def _extract_location_hint(query: str) -> str:
    text = (query or "").strip()
    if not text:
        return ""

    match = re.search(r"\bin\s+([A-Za-z][A-Za-z\s]{1,40})", text, flags=re.IGNORECASE)
    if not match:
        return ""

    location_raw = re.sub(r"\s+", " ", match.group(1)).strip(" .,")
    stop_words = ["that", "with", "who", "which", "having", "without"]
    parts = location_raw.split()
    cleaned_parts: List[str] = []
    for token in parts:
        if token.lower() in stop_words:
            break
        cleaned_parts.append(token)

    return " ".join(cleaned_parts).strip()


def _run_search(params: Dict[str, Any]) -> Any:
    clean_params = {key: value for key, value in params.items() if value not in (None, "")}
    response = requests.get(_SERPAPI_ENDPOINT, params=clean_params, timeout=35)
    if response.status_code >= 400:
        raise ValueError(f"SerpApi request failed: {response.status_code} {response.text[:240]}")
    try:
        return response.json()
    except Exception as error:
        raise ValueError(f"SerpApi returned non-JSON response: {error}") from error


def _extract_organic_results(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, dict):
        rows = payload.get("organic_results") or []
        if isinstance(rows, list):
            return [item for item in rows if isinstance(item, dict)]
    return []


def _extract_local_places(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if not isinstance(payload, dict):
        return []

    local_results = payload.get("local_results")
    if isinstance(local_results, dict):
        places = local_results.get("places") or []
        if isinstance(places, list):
            return [item for item in places if isinstance(item, dict)]

    if isinstance(local_results, list):
        return [item for item in local_results if isinstance(item, dict)]

    places_fallback = payload.get("places")
    if isinstance(places_fallback, list):
        return [item for item in places_fallback if isinstance(item, dict)]

    return []


def search_google_business_results(
    query: str,
    *,
    num: int = 10,
    gl: str = "in",
    hl: str = "en",
) -> List[Dict[str, str]]:
    key = get_serpapi_key()
    if not key:
        raise ValueError("SerpApi key missing. Set SERPAPI_API_KEY (or SERP_API_KEY) in root .env")

    q = (query or "").strip()
    if not q:
        raise ValueError("Lead generation query is required")

    bounded_num = max(1, min(int(num), 20))

    location_hint = _extract_location_hint(q)

    payload = _run_search(
        {
            "engine": "google",
            "q": q,
            "api_key": key,
            "num": bounded_num,
            "gl": gl,
            "hl": hl,
            "location": location_hint or None,
        }
    )

    local_query = q
    if "business" not in local_query.lower():
        local_query = f"businesses {local_query}".strip()

    local_payload = _run_search(
        {
            "engine": "google",
            "q": local_query,
            "api_key": key,
            "num": bounded_num,
            "gl": gl,
            "hl": hl,
            "tbm": "lcl",
            "location": location_hint or None,
        }
    )

    results: List[Dict[str, str]] = []

    for item in _extract_organic_results(payload):
        normalized = _normalize_organic_result(item)
        if any(normalized.values()):
            results.append(normalized)

    places = _extract_local_places(payload)
    for place in places:
        normalized = _normalize_local_result(place)
        if any(normalized.values()):
            results.append(normalized)

    local_places = _extract_local_places(local_payload)
    for place in local_places:
        normalized = _normalize_local_result(place)
        if any(normalized.values()):
            results.append(normalized)

    # Deduplicate by title+link pair while preserving order.
    deduped: List[Dict[str, str]] = []
    seen = set()
    for item in results:
        key = (item.get("title", "").lower(), item.get("link", "").lower())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    # Prefer local business records first so dashboard shows actionable companies.
    local_first = sorted(deduped, key=lambda item: 0 if item.get("source_type") == "local" else 1)
    return local_first[:bounded_num]


def build_search_context(results: List[Dict[str, str]], max_items: int = 8) -> str:
    lines: List[str] = []
    for item in (results or [])[:max_items]:
        title = str(item.get("title") or "").strip()
        snippet = str(item.get("snippet") or "").strip()
        link = str(item.get("link") or "").strip()
        lines.append(f"Title: {title}\nSnippet: {snippet}\nLink: {link}")

    return "\n\n".join(lines).strip()


def pick_best_website(results: List[Dict[str, str]]) -> str:
    for item in results or []:
        link = str(item.get("link") or "").strip()
        if link.startswith("http://") or link.startswith("https://"):
            return link
    return ""
