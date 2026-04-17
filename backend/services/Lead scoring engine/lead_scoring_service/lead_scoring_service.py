from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

try:
    from .model_loader import (
        ARTIFACT_DIR,
        ENCODER_PATH,
        METADATA_PATH,
        MODEL_PATH,
        load_encoder,
        load_metadata,
        load_model,
        save_artifacts,
    )
except ImportError:
    from model_loader import (
        ARTIFACT_DIR,
        ENCODER_PATH,
        METADATA_PATH,
        MODEL_PATH,
        load_encoder,
        load_metadata,
        load_model,
        save_artifacts,
    )


LOGGER = logging.getLogger(__name__)

FEATURE_COLUMNS = [
    "industry",
    "budget",
    "response_speed",
    "meeting_count",
    "email_open_rate",
    "website_visits",
]

POSITIVE_OUTCOMES = {
    "1",
    "true",
    "won",
    "closed won",
    "closed-won",
    "converted",
    "hired",
    "successful",
    "deal closed",
}

NEGATIVE_OUTCOMES = {
    "0",
    "false",
    "lost",
    "closed lost",
    "closed-lost",
    "failed",
    "not converted",
    "rejected",
}

OUTCOME_COLUMNS = [
    "outcome",
    "deal_outcome",
    "deal_status",
    "status",
    "interview_status",
    "converted",
    "is_converted",
]


class LeadScoringError(RuntimeError):
    """Raised when lead scoring inference or training fails."""


def _to_float(value: Any, field_name: str) -> float:
    if value is None:
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        normalized = value.strip().replace(",", "")
        if not normalized:
            return 0.0
        try:
            return float(normalized)
        except Exception as error:
            raise ValueError(f"Invalid numeric value for '{field_name}': {value}") from error

    raise ValueError(f"Unsupported value type for '{field_name}': {type(value).__name__}")


def _normalize_email_open_rate(value: Any) -> float:
    rate = _to_float(value, "email_open_rate")
    if rate < 0:
        return 0.0
    # Support both [0, 1] and [0, 100] conventions.
    if rate > 1:
        return min(rate / 100.0, 1.0)
    return min(rate, 1.0)


def _normalize_industry(raw_value: Any) -> str:
    value = str(raw_value or "").strip()
    return value or "unknown"


def _normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "industry": _normalize_industry(record.get("industry")),
        "budget": _to_float(record.get("budget", 0), "budget"),
        "response_speed": _to_float(record.get("response_speed", 0), "response_speed"),
        "meeting_count": _to_float(record.get("meeting_count", 0), "meeting_count"),
        "email_open_rate": _normalize_email_open_rate(record.get("email_open_rate", 0)),
        "website_visits": _to_float(record.get("website_visits", 0), "website_visits"),
    }


def _extract_binary_outcome(record: Dict[str, Any]) -> Optional[int]:
    for column in OUTCOME_COLUMNS:
        if column not in record:
            continue

        raw_value = record.get(column)
        normalized = str(raw_value).strip().lower()
        if normalized in POSITIVE_OUTCOMES:
            return 1
        if normalized in NEGATIVE_OUTCOMES:
            return 0

    return None


def _preprocess_input(lead: Dict[str, Any], encoder: LabelEncoder) -> pd.DataFrame:
    normalized = _normalize_record(lead)

    industry = normalized["industry"]
    classes = set(encoder.classes_.tolist())
    if industry not in classes:
        industry = "unknown" if "unknown" in classes else sorted(classes)[0]

    encoded = encoder.transform([industry])[0]

    data = pd.DataFrame(
        [
            {
                "industry": encoded,
                "budget": normalized["budget"],
                "response_speed": normalized["response_speed"],
                "meeting_count": normalized["meeting_count"],
                "email_open_rate": normalized["email_open_rate"],
                "website_visits": normalized["website_visits"],
            }
        ]
    )

    return data


def _build_training_dataset(historical_records: Iterable[Dict[str, Any]]) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []

    for record in historical_records:
        outcome = _extract_binary_outcome(record)
        if outcome is None:
            continue

        normalized = _normalize_record(record)
        normalized["converted"] = outcome
        rows.append(normalized)

    dataset = pd.DataFrame(rows)
    if dataset.empty:
        raise LeadScoringError(
            "No trainable historical rows found. Ensure records have closed-won/lost outcomes."
        )

    return dataset


def train_from_historical_data(
    historical_records: Iterable[Dict[str, Any]],
    *,
    min_rows: int = 40,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Train and persist the lead scoring model from closed-won vs lost historical records.

    The model predicts conversion probability from:
    industry, budget, response_speed, meeting_count, email_open_rate, website_visits.
    """
    dataset = _build_training_dataset(historical_records)
    if len(dataset) < min_rows:
        raise LeadScoringError(
            f"Insufficient training data: {len(dataset)} rows. Minimum required: {min_rows}."
        )

    y = dataset["converted"].astype(int)
    if y.nunique() < 2:
        raise LeadScoringError("Training data must include both won and lost outcomes.")

    industry_encoder = LabelEncoder()
    dataset["industry"] = industry_encoder.fit_transform(dataset["industry"])

    x = dataset[FEATURE_COLUMNS]

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=random_state,
        stratify=y,
    )

    base_model = RandomForestClassifier(
        n_estimators=300,
        random_state=random_state,
        class_weight="balanced",
        min_samples_leaf=2,
    )

    calibrated_model = CalibratedClassifierCV(base_model, method="isotonic", cv=3)
    calibrated_model.fit(x_train, y_train)

    probabilities = calibrated_model.predict_proba(x_test)[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, predictions)), 4),
        "precision": round(float(precision_score(y_test, predictions)), 4),
        "recall": round(float(recall_score(y_test, predictions)), 4),
        "f1": round(float(f1_score(y_test, predictions)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, probabilities)), 4),
        "brier_score": round(float(brier_score_loss(y_test, probabilities)), 4),
    }

    metadata = {
        "model_name": "Calibrated RandomForestClassifier",
        "training_date_utc": datetime.now(timezone.utc).isoformat(),
        "feature_columns": FEATURE_COLUMNS,
        "target_column": "converted",
        "dataset_rows": int(len(dataset)),
        "positive_rows": int(y.sum()),
        "negative_rows": int((1 - y).sum()),
        "metrics": metrics,
        "outcome_definition": {
            "positive": sorted(POSITIVE_OUTCOMES),
            "negative": sorted(NEGATIVE_OUTCOMES),
        },
        "industry_classes": sorted(dataset["industry"].unique().tolist()),
    }

    save_artifacts(calibrated_model, industry_encoder, metadata)
    LOGGER.info("Lead scoring model trained and saved successfully")

    return metadata


def predict_conversion_probability(lead: Dict[str, Any]) -> float:
    """
    Predict conversion probability as a percentage.

    Returns:
        float: probability percentage in range [0, 100].
    """
    try:
        model = load_model()
        encoder = load_encoder()

        processed_input = _preprocess_input(lead, encoder)
        probability = float(model.predict_proba(processed_input)[0][1])

        return round(probability * 100.0, 2)

    except Exception as error:
        raise LeadScoringError(f"Lead scoring inference failed: {error}") from error


def predict_conversion_probability_details(lead: Dict[str, Any]) -> Dict[str, Any]:
    """
    Return prediction payload with both ratio and percentage fields.
    """
    percentage = predict_conversion_probability(lead)
    ratio = round(percentage / 100.0, 6)

    metadata = load_metadata()
    model_name = metadata.get("model_name")
    if not model_name:
        try:
            loaded_model = load_model()
            model_name = type(loaded_model).__name__
        except Exception:
            model_name = "unknown"

    return {
        "conversion_probability_pct": percentage,
        "conversion_probability_ratio": ratio,
        "model_name": model_name,
        "trained_at": metadata.get("training_date_utc"),
    }


def get_conversion_model_info() -> Dict[str, Any]:
    """Return conversion-model type, artifact paths, and available metrics."""
    metadata = load_metadata() or {}

    model_class = None
    model_module = None
    model_ready = False
    model_load_error = None

    try:
        loaded_model = load_model()
        model_ready = True
        model_class = type(loaded_model).__name__
        model_module = type(loaded_model).__module__
    except Exception as error:
        model_load_error = str(error)

    return {
        "model_ready": model_ready,
        "model_name": metadata.get("model_name") or model_class or "unknown",
        "model_class": model_class,
        "model_module": model_module,
        "artifact_dir": str(ARTIFACT_DIR),
        "artifacts": {
            "model": str(MODEL_PATH),
            "encoder": str(ENCODER_PATH),
            "metadata": str(METADATA_PATH),
            "metadata_exists": METADATA_PATH.exists(),
        },
        "trained_at": metadata.get("training_date_utc"),
        "metrics": metadata.get("metrics", {}),
        "metrics_available": bool(metadata.get("metrics")),
        "metadata": metadata,
        "model_load_error": model_load_error,
    }


_SERVICE_KEYWORDS: Dict[str, Dict[str, Any]] = {
    "Software Development / MERN Stack": {
        "weight": 28,
        "keywords": [
            "without website",
            "no website",
            "missing website",
            "outdated website",
            "website redesign",
            "poor website",
            "broken site",
            "no online presence",
            "web app",
            "application development",
            "mern",
            "react",
            "node.js",
            "full stack",
        ],
    },
    "AI Integration / AI-ML Solutions": {
        "weight": 20,
        "keywords": [
            "ai",
            "machine learning",
            "ml",
            "analytics",
            "prediction",
            "automation",
            "intelligence",
            "chatbot",
            "recommendation",
        ],
    },
    "Cloud Solutions": {
        "weight": 18,
        "keywords": [
            "cloud",
            "aws",
            "azure",
            "gcp",
            "scalable",
            "infrastructure",
            "migration",
            "devops",
            "kubernetes",
        ],
    },
    "Blockchain Solutions": {
        "weight": 16,
        "keywords": [
            "blockchain",
            "web3",
            "smart contract",
            "token",
            "ledger",
            "decentralized",
        ],
    },
    "Cybersecurity Services": {
        "weight": 17,
        "keywords": [
            "security",
            "cybersecurity",
            "breach",
            "compliance",
            "vulnerability",
            "threat",
            "data protection",
        ],
    },
    "Resource Deployment Services": {
        "weight": 22,
        "keywords": [
            "startup",
            "expansion",
            "hiring",
            "scaling",
            "new branch",
            "funding",
            "growth phase",
            "dedicated developer",
            "team augmentation",
            "resource deployment",
        ],
    },
}

_URGENCY_KEYWORDS = {
    "urgent",
    "immediate",
    "asap",
    "struggling",
    "needs help",
    "looking for",
    "seeking",
    "require",
}

_LOCATION_PATTERN = re.compile(
    r"\b(?:in|at|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}(?:,\s*[A-Z]{2})?)"
)

_KNOWN_AGGREGATOR_DOMAINS = {
    "google.com",
    "www.google.com",
    "maps.google.com",
    "facebook.com",
    "www.facebook.com",
    "yelp.com",
    "www.yelp.com",
    "yellowpages.com",
    "www.yellowpages.com",
    "linkedin.com",
    "www.linkedin.com",
    "indeed.com",
    "www.indeed.com",
    "crunchbase.com",
    "www.crunchbase.com",
    "serpapi.com",
    "www.serpapi.com",
    "justdial.com",
    "www.justdial.com",
    "sulekha.com",
    "www.sulekha.com",
    "indiamart.com",
    "www.indiamart.com",
}

_LISTING_KEYWORDS = {
    "list of",
    "top ",
    "directory",
    "view list",
    "justdial",
    "sulekha",
    "indiamart",
    "yelp",
}

_EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE_PATTERN = re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,6}")

_INDUSTRY_RULES = [
    ("Marketing & Advertising", ["seo", "marketing", "advertising", "branding"]),
    ("Software / SaaS", ["saas", "software", "platform", "cloud", "app"]),
    ("Healthcare", ["clinic", "health", "medical", "hospital", "dental"]),
    ("Real Estate", ["real estate", "property", "realtor", "brokerage"]),
    ("E-commerce / Retail", ["ecommerce", "retail", "shop", "store", "merchant"]),
    ("Professional Services", ["consulting", "agency", "firm", "services"]),
    ("Manufacturing", ["manufacturing", "factory", "industrial", "supply chain"]),
    ("Finance", ["finance", "fintech", "bank", "insurance", "wealth"]),
    ("Education", ["education", "school", "academy", "edtech", "training"]),
]


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip()


def _extract_domain(url: str) -> str:
    parsed = urlparse((url or "").strip())
    return parsed.netloc.lower().strip()


def _extract_email(text: str) -> str:
    match = _EMAIL_PATTERN.search(text or "")
    return match.group(0) if match else "Unknown"


def _extract_phone(text: str) -> str:
    match = _PHONE_PATTERN.search(text or "")
    if not match:
        return "Unknown"
    return _normalize_whitespace(match.group(0))


def _normalize_website_url(raw_website: str, fallback_link: str) -> str:
    website = (raw_website or "").strip()
    if website and website.startswith(("http://", "https://")):
        return website

    link = (fallback_link or "").strip()
    if link.startswith(("http://", "https://")):
        domain = _extract_domain(link)
        if domain and domain not in _KNOWN_AGGREGATOR_DOMAINS:
            return link

    return "Unknown"


def _is_listing_result(title: str, snippet: str) -> bool:
    text = f"{title} {snippet}".lower()
    return any(keyword in text for keyword in _LISTING_KEYWORDS)


def _infer_contact_role(primary_service: str) -> str:
    lower = primary_service.lower()
    if "ai" in lower:
        return "CTO / Head of AI"
    if "cloud" in lower:
        return "CTO / DevOps Lead"
    if "cyber" in lower:
        return "CISO / IT Head"
    if "blockchain" in lower:
        return "CTO / Product Head"
    if "resource" in lower:
        return "Founder / HR Head"
    return "Founder / Operations Head"


def _domain_to_business_name(domain: str) -> str:
    if not domain:
        return "Unknown"

    normalized = domain.replace("www.", "")
    host_parts = [part for part in normalized.split(".") if part]
    if not host_parts:
        return "Unknown"

    root = host_parts[0].replace("-", " ").replace("_", " ").strip()
    if not root:
        return "Unknown"

    return " ".join(token.capitalize() for token in root.split())


def _extract_business_name(title: str, link: str) -> str:
    cleaned_title = _normalize_whitespace(title)
    if cleaned_title:
        for separator in ["|", " - ", " – ", " — ", ":"]:
            if separator in cleaned_title:
                candidate = _normalize_whitespace(cleaned_title.split(separator)[0])
                if len(candidate) >= 2:
                    return candidate
        return cleaned_title

    return _domain_to_business_name(_extract_domain(link))


def _infer_industry(text: str) -> str:
    lowered = (text or "").lower()
    for industry, keywords in _INDUSTRY_RULES:
        if any(keyword in lowered for keyword in keywords):
            return industry
    return "Unknown"


def _infer_location(text: str) -> str:
    match = _LOCATION_PATTERN.search(text or "")
    if not match:
        return "Unknown"
    return _normalize_whitespace(match.group(1)) or "Unknown"


def _infer_website_presence(snippet: str, link: str, website_url: str, query_context: str = "") -> str:
    combined = f"{snippet} {link} {query_context}".lower()
    if website_url and website_url != "Unknown":
        return "Yes"

    if any(phrase in combined for phrase in ["without website", "no website", "missing website"]):
        return "No"

    domain = _extract_domain(link)
    if domain and domain not in _KNOWN_AGGREGATOR_DOMAINS:
        return "Yes"

    if any(phrase in combined for phrase in ["website", "visit us", "online store", "www."]):
        return "Yes"

    return "Unknown"


def _score_services(text: str, website_presence: str) -> Dict[str, int]:
    lowered = (text or "").lower()
    scores: Dict[str, int] = {service: 0 for service in _SERVICE_KEYWORDS}

    for service, config in _SERVICE_KEYWORDS.items():
        base_weight = int(config["weight"])
        keyword_hits = sum(1 for keyword in config["keywords"] if keyword in lowered)
        if keyword_hits:
            scores[service] += base_weight + (keyword_hits - 1) * 5

    if website_presence == "No":
        scores["Software Development / MERN Stack"] += 30
        scores["Cloud Solutions"] += 6
    elif website_presence == "Unknown":
        scores["Software Development / MERN Stack"] += 8

    return scores


def _score_urgency(text: str) -> int:
    lowered = (text or "").lower()
    return sum(8 for keyword in _URGENCY_KEYWORDS if keyword in lowered)


def _build_reasoning(
    business_name: str,
    primary_service: str,
    website_presence: str,
    service_scores: Dict[str, int],
    urgency_score: int,
) -> str:
    top_signals = sorted(service_scores.items(), key=lambda item: item[1], reverse=True)[:2]
    signal_labels = ", ".join(
        f"{service}({score})" for service, score in top_signals if score > 0
    )
    if not signal_labels:
        signal_labels = "limited explicit need signals"

    return (
        f"{business_name} shows strongest need for {primary_service}. "
        f"Website presence: {website_presence}. "
        f"Detected signals: {signal_labels}; urgency score {urgency_score}."
    )


def _classify_lead(score: int) -> str:
    if score >= 75:
        return "HOT"
    if score >= 45:
        return "WARM"
    return "COLD"


def _build_lead_from_search_result(search_result: Dict[str, Any], query_context: str = "") -> Dict[str, Any]:
    title = str(search_result.get("title") or "")
    snippet = str(search_result.get("snippet") or "")
    link = str(search_result.get("link") or "")
    phone_hint = str(search_result.get("phone") or "")
    email_hint = str(search_result.get("email") or "")
    address_hint = str(search_result.get("address") or "")
    industry_hint = str(search_result.get("industry") or "")
    website_raw = str(search_result.get("website") or "")
    contact_person_hint = str(search_result.get("contact_person") or "").strip()

    website_url = _normalize_website_url(website_raw, link)
    context_text = _normalize_whitespace(
        f"{title}. {snippet}. {link}. {query_context}. {industry_hint}. {address_hint}"
    )

    business_name = _extract_business_name(title, link)
    industry = industry_hint or _infer_industry(context_text)
    location = address_hint or _infer_location(f"{title} {snippet} {query_context}")
    website_presence = _infer_website_presence(snippet, link, website_url, query_context=query_context)

    service_scores = _score_services(context_text, website_presence)
    urgency_score = _score_urgency(context_text)
    growth_score = service_scores.get("Resource Deployment Services", 0)
    strength_score = max(service_scores.values()) if service_scores else 0

    confidence_score = max(0, min(100, int(strength_score + urgency_score + (growth_score * 0.35))))
    lead_category = _classify_lead(confidence_score)

    ranked_services = [
        service
        for service, score in sorted(service_scores.items(), key=lambda item: item[1], reverse=True)
        if score > 0
    ]

    if ranked_services:
        primary_service = ranked_services[0]
        secondary_services = ranked_services[1:3]
    else:
        primary_service = "Software Development / MERN Stack"
        secondary_services = []

    reasoning = _build_reasoning(
        business_name=business_name,
        primary_service=primary_service,
        website_presence=website_presence,
        service_scores=service_scores,
        urgency_score=urgency_score,
    )

    contact_phone = phone_hint or _extract_phone(snippet)
    contact_email = email_hint or _extract_email(snippet)
    source_link = link if link else "Unknown"
    contact_role = _infer_contact_role(primary_service)
    contact_person = contact_person_hint or contact_role

    return {
        "business_name": business_name,
        "industry": industry,
        "location": location,
        "website_present": website_presence,
        "company_website": website_url,
        "contact_person": contact_person,
        "contact_phone": contact_phone,
        "contact_email": contact_email,
        "source_link": source_link,
        "primary_service_needed": primary_service,
        "secondary_services": secondary_services,
        "lead_category": lead_category,
        "confidence_score": confidence_score,
        "reasoning": reasoning,
    }


def qualify_search_results(
    search_results: Iterable[Dict[str, Any]],
    query_context: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Transform SerpApi-like search results into CRM-ready qualified leads.

    Each input item may contain title, snippet, and link fields.
    """
    if search_results is None:
        raise LeadScoringError("search_results payload is required")

    qualified_leads: List[Dict[str, Any]] = []
    context = str(query_context or "").strip()

    for item in search_results:
        if not isinstance(item, dict):
            continue
        if not any(item.get(key) for key in ("title", "snippet", "link")):
            continue

        title = str(item.get("title") or "")
        snippet = str(item.get("snippet") or "")
        website = str(item.get("website") or "")
        phone = str(item.get("phone") or "")
        address = str(item.get("address") or "")
        source_type = str(item.get("source_type") or "").lower()

        if _is_listing_result(title, snippet):
            # Keep only local-place records with at least one actionable contact/location signal.
            if source_type != "local":
                continue
            if not any([phone, address, website]):
                continue

        qualified_leads.append(_build_lead_from_search_result(item, query_context=context))

    if not qualified_leads:
        for item in search_results:
            if not isinstance(item, dict):
                continue
            if not any(item.get(key) for key in ("title", "snippet", "link")):
                continue
            qualified_leads.append(_build_lead_from_search_result(item, query_context=context))

    return qualified_leads