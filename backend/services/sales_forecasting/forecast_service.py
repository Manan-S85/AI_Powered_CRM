from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Tuple


def _to_float(value: Any) -> float:
    
    """Convert value to float safely. Invalid values return 0.0."""
    
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
        except Exception:
            return 0.0

    return 0.0


def _normalize_status(status: Any) -> str:
    
    """Normalize lead status for consistent comparison."""
    
    if status is None:
        return ""
    return str(status).strip().lower()


def _parse_closed_date(date_value: Any) -> Tuple[int, int]:
    
    """
    Parse closed_date to (year, month).

    Supports datetime objects, ISO strings and common date formats.
    Raises ValueError on invalid or missing values.
    """
    
    if date_value is None:
        raise ValueError("closed_date is required")

    if isinstance(date_value, datetime):
        return date_value.year, date_value.month

    text = str(date_value).strip()
    if not text:
        raise ValueError("closed_date is empty")

    # Prefer ISO parsing, then fallback known formats.
    try:
        parsed = datetime.fromisoformat(text)
        return parsed.year, parsed.month
    except Exception:
        pass

    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.year, parsed.month
        except Exception:
            continue

    raise ValueError(f"invalid closed_date: {text}")


def calculate_closed_revenue(leads: List[Dict[str, Any]]) -> float:
    
    """
    Calculate the total revenue for closed leads.

    Args:
        leads: list of lead dictionaries.

    Returns:
        Total closed deal value as float rounded to 2 decimals.
    """
    
    if not isinstance(leads, list):
        return 0.0

    total_revenue = 0.0
    for lead in leads:
        if not isinstance(lead, dict):
            continue

        if _normalize_status(lead.get("status")) != "closed":
            continue

        total_revenue += _to_float(lead.get("deal_value"))

    return round(total_revenue, 2)


def predict_monthly_revenue(leads: List[Dict[str, Any]]) -> float:
    
    """Alias for calculate_closed_revenue (kept for API compatibility)."""
    
    return calculate_closed_revenue(leads)


def calculate_pipeline_health(leads: List[Dict[str, Any]]) -> str:
    """
    
    Determine pipeline health based on closed lead ratio.

    Args:
        leads: list of lead dictionaries.

    Returns:
        "Excellent", "Good", "Poor" or "No Data".
    """
    
    if not isinstance(leads, list):
        return "No Data"

    total_leads = 0
    closed_leads = 0

    for lead in leads:
        if not isinstance(lead, dict):
            continue

        total_leads += 1
        if _normalize_status(lead.get("status")) == "closed":
            closed_leads += 1

    if total_leads == 0:
        return "No Data"

    ratio = closed_leads / total_leads

    if ratio > 0.7:
        return "Excellent"
    if ratio > 0.4:
        return "Good"
    return "Poor"


def analyze_closure_trend(leads: List[Dict[str, Any]]) -> str:
    
    """
    Analyze month-over-month trend for closed leads.

    Args:
        leads: list of lead dictionaries.

    Returns:
        "Increasing", "Decreasing" or "Stable".
    """
    
    if not isinstance(leads, list):
        return "Stable"

    closed_by_month: Dict[Tuple[int, int], int] = defaultdict(int)

    for lead in leads:
        if not isinstance(lead, dict):
            continue

        if _normalize_status(lead.get("status")) != "closed":
            continue

        try:
            year_month = _parse_closed_date(lead.get("closed_date"))
            closed_by_month[year_month] += 1
        except Exception:
            continue

    if len(closed_by_month) < 2:
        return "Stable"

    sorted_months = sorted(closed_by_month)
    prev_month, last_month = sorted_months[-2], sorted_months[-1]

    previous_count = closed_by_month[prev_month]
    current_count = closed_by_month[last_month]

    if current_count > previous_count:
        return "Increasing"
    if current_count < previous_count:
        return "Decreasing"
    return "Stable"


def generate_sales_forecast(leads: List[Dict[str, Any]]) -> Dict[str, Any]:
    
    """
    Produce full sales forecast summary from lead data.

    Args:
        leads: list of lead dictionaries.

    Returns:
        Dict with keys: monthly_revenue, pipeline_health, closure_trend, total_leads.
    """
    
    if not isinstance(leads, list):
        leads = []

    total_leads = sum(1 for item in leads if isinstance(item, dict))

    return {
        "monthly_revenue": calculate_closed_revenue(leads),
        "pipeline_health": calculate_pipeline_health(leads),
        "closure_trend": analyze_closure_trend(leads),
        "total_leads": total_leads,
    }

