from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

CLOSED_STATUSES = {
    "closed",
    "won",
    "converted",
    "hired",
    "successful",
    "deal closed",
}


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


def _is_closed_lead(lead: Dict[str, Any]) -> bool:
    """Return True when a lead can be treated as closed/won."""

    status = _normalize_status(lead.get("status"))
    interview_status = _normalize_status(lead.get("interview_status"))

    if status in CLOSED_STATUSES:
        return True
    if interview_status in CLOSED_STATUSES:
        return True

    return False


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


def _parse_any_date(date_value: Any) -> datetime:
    """
    Parse a broad set of date values into datetime.

    Raises ValueError if parsing fails.
    """

    if date_value is None:
        raise ValueError("date is required")

    if isinstance(date_value, datetime):
        return date_value

    text = str(date_value).strip()
    if not text:
        raise ValueError("date is empty")

    normalized = text.replace("Z", "+00:00")

    try:
        return datetime.fromisoformat(normalized)
    except Exception:
        pass

    for fmt in (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    ):
        try:
            return datetime.strptime(text, fmt)
        except Exception:
            continue

    raise ValueError(f"invalid date: {text}")


def _resolve_lead_value(lead: Dict[str, Any]) -> float:
    """Get the most relevant numeric deal value from lead fields."""

    for key in ("deal_value", "amount", "expected_revenue", "expected_salary", "salary"):
        value = _to_float(lead.get(key))
        if value > 0:
            return value
    return 0.0


def _resolve_lead_date(lead: Dict[str, Any]) -> Optional[datetime]:
    """Pick a lead date from common fields for trend analysis."""

    for field in ("closed_date", "updated_at", "processed_at", "created_at"):
        raw = lead.get(field)
        if raw is None:
            continue
        try:
            return _parse_any_date(raw)
        except Exception:
            continue
    return None


def _month_label(year: int, month: int) -> str:
    return datetime(year, month, 1).strftime("%b %Y")


def _month_start(dt: datetime) -> datetime:
    return datetime(dt.year, dt.month, 1)


def _shift_month(dt: datetime, delta: int) -> datetime:
    """Shift a datetime by whole calendar months."""

    year = dt.year + ((dt.month - 1 + delta) // 12)
    month = ((dt.month - 1 + delta) % 12) + 1
    return datetime(year, month, 1)


def _build_monthly_series(leads: List[Dict[str, Any]], months: int, reference_date: Optional[datetime]) -> List[Dict[str, Any]]:
    """Build month-wise closed deal count and revenue series."""

    if months < 1:
        months = 1

    anchor_date = reference_date or datetime.now()
    anchor_month = _month_start(anchor_date)

    series_map: Dict[Tuple[int, int], Dict[str, Any]] = defaultdict(lambda: {
        "closed_deals": 0,
        "monthly_revenue": 0.0,
    })

    for lead in leads:
        if not isinstance(lead, dict) or not _is_closed_lead(lead):
            continue

        lead_dt = _resolve_lead_date(lead)
        if lead_dt is None:
            continue

        month_key = (lead_dt.year, lead_dt.month)
        series_map[month_key]["closed_deals"] += 1
        series_map[month_key]["monthly_revenue"] += _resolve_lead_value(lead)

    result: List[Dict[str, Any]] = []
    start_month = _shift_month(anchor_month, -(months - 1))

    for offset in range(months):
        point = _shift_month(start_month, offset)
        key = (point.year, point.month)
        month_data = series_map.get(key, {"closed_deals": 0, "monthly_revenue": 0.0})
        result.append(
            {
                "year": point.year,
                "month": point.month,
                "label": _month_label(point.year, point.month),
                "closed_deals": int(month_data["closed_deals"]),
                "monthly_revenue": round(float(month_data["monthly_revenue"]), 2),
            }
        )

    return result


def _direction_from_values(values: List[float], tolerance: float = 0.03) -> str:
    """Return Increasing/Decreasing/Stable from the last two non-zero points."""

    cleaned = [float(v) for v in values if float(v) >= 0]
    if len(cleaned) < 2:
        return "Stable"

    previous = cleaned[-2]
    current = cleaned[-1]

    if previous == 0 and current == 0:
        return "Stable"
    if previous == 0 and current > 0:
        return "Increasing"

    delta_ratio = (current - previous) / max(previous, 1.0)
    if delta_ratio > tolerance:
        return "Increasing"
    if delta_ratio < -tolerance:
        return "Decreasing"
    return "Stable"


def calculate_closed_revenue(leads: List[Dict[str, Any]], year: Optional[int] = None, month: Optional[int] = None) -> float:
    
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

        if not _is_closed_lead(lead):
            continue

        if year is not None or month is not None:
            lead_dt = _resolve_lead_date(lead)
            if lead_dt is None:
                continue
            if year is not None and lead_dt.year != year:
                continue
            if month is not None and lead_dt.month != month:
                continue

        total_revenue += _resolve_lead_value(lead)

    return round(total_revenue, 2)


def predict_monthly_revenue(leads: List[Dict[str, Any]], year: Optional[int] = None, month: Optional[int] = None) -> float:
    
    """Alias for calculate_closed_revenue (kept for API compatibility)."""
    
    return calculate_closed_revenue(leads, year=year, month=month)


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
        if _is_closed_lead(lead):
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

        if not _is_closed_lead(lead):
            continue

        try:
            lead_dt = _resolve_lead_date(lead)
            if lead_dt is None:
                continue
            year_month = (lead_dt.year, lead_dt.month)
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

    now = datetime.now()

    return {
        "monthly_revenue": calculate_closed_revenue(leads, year=now.year, month=now.month),
        "pipeline_health": calculate_pipeline_health(leads),
        "closure_trend": analyze_closure_trend(leads),
        "total_leads": total_leads,
    }


def generate_sales_forecast_report(
    leads: List[Dict[str, Any]],
    months: int = 6,
    reference_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Generate a richer sales forecasting report for dashboarding.

    Includes monthly revenue signal, pipeline health metrics, and closure trend timeline.
    """

    if not isinstance(leads, list):
        leads = []

    month_span = max(3, min(int(months), 24))
    now = reference_date or datetime.now()

    valid_leads = [item for item in leads if isinstance(item, dict)]
    total_leads = len(valid_leads)
    closed_leads = [lead for lead in valid_leads if _is_closed_lead(lead)]
    open_leads = [lead for lead in valid_leads if not _is_closed_lead(lead)]

    monthly_series = _build_monthly_series(valid_leads, months=month_span, reference_date=now)
    revenue_values = [point["monthly_revenue"] for point in monthly_series]
    closure_values = [point["closed_deals"] for point in monthly_series]

    current_month_revenue = revenue_values[-1] if revenue_values else 0.0

    # Weighted moving average for next month projection with stronger weight on recency.
    tail = revenue_values[-3:] if len(revenue_values) >= 3 else revenue_values
    if tail:
        weights = list(range(1, len(tail) + 1))
        weighted_sum = sum(value * weight for value, weight in zip(tail, weights))
        projected_next_month = weighted_sum / sum(weights)
    else:
        projected_next_month = 0.0

    closed_revenue_total = calculate_closed_revenue(valid_leads)
    open_pipeline_value = round(sum(_resolve_lead_value(lead) for lead in open_leads), 2)

    close_rate = (len(closed_leads) / total_leads) if total_leads else 0.0
    close_rate_percent = round(close_rate * 100, 2)

    if close_rate >= 0.7:
        pipeline_status = "Excellent"
    elif close_rate >= 0.45:
        pipeline_status = "Good"
    elif close_rate >= 0.25:
        pipeline_status = "Watch"
    else:
        pipeline_status = "Poor"

    revenue_trend = _direction_from_values(revenue_values)
    closure_trend = _direction_from_values([float(v) for v in closure_values], tolerance=0.05)

    if pipeline_status == "Excellent":
        recommendation = "Strong momentum. Focus on scaling the current acquisition channels."
    elif pipeline_status == "Good":
        recommendation = "Healthy pipeline. Improve close rate with targeted follow-ups on warm opportunities."
    elif pipeline_status == "Watch":
        recommendation = "Pipeline needs attention. Improve qualification and proposal turnaround time."
    else:
        recommendation = "Urgent improvement needed. Revisit lead quality, nurturing cadence, and deal execution."

    return {
        "overview": {
            "total_leads": total_leads,
            "closed_deals": len(closed_leads),
            "open_deals": len(open_leads),
            "reporting_months": month_span,
            "generated_at": now.isoformat(),
        },
        "monthly_revenue": {
            "current_month": round(float(current_month_revenue), 2),
            "projected_next_month": round(float(projected_next_month), 2),
            "closed_revenue_total": round(float(closed_revenue_total), 2),
            "trend": revenue_trend,
            "currency": "INR",
        },
        "pipeline_health": {
            "status": pipeline_status,
            "close_rate": close_rate_percent,
            "open_pipeline_value": open_pipeline_value,
            "closed_deals": len(closed_leads),
            "total_deals": total_leads,
        },
        "deal_closure_trends": {
            "trend": closure_trend,
            "monthly_series": monthly_series,
        },
        "founder_insight": recommendation,
    }

