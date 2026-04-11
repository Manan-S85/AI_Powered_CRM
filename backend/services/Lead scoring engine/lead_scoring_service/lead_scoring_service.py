from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

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
    from .model_loader import load_encoder, load_metadata, load_model, save_artifacts
except ImportError:
    from model_loader import load_encoder, load_metadata, load_model, save_artifacts


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

    return {
        "conversion_probability_pct": percentage,
        "conversion_probability_ratio": ratio,
        "model_name": metadata.get("model_name", "unknown"),
        "trained_at": metadata.get("training_date_utc"),
    }