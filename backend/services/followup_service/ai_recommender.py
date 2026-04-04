from __future__ import annotations

from typing import Any, Dict


def _format_hour_label(hour_24: int) -> str:
    hour = int(hour_24) % 24
    suffix = "AM" if hour < 12 else "PM"
    display = hour % 12
    if display == 0:
        display = 12
    return f"{display}:00 {suffix}"


def _time_bucket(hour_24: int) -> str:
    hour = int(hour_24) % 24
    if 5 <= hour < 12:
        return "Morning"
    if 12 <= hour < 17:
        return "Afternoon"
    if 17 <= hour < 21:
        return "Evening"
    return "Night"


def _humanize_duration(hours_value: float) -> str:
    hours = max(0.0, float(hours_value))
    if hours < 1:
        minutes = max(1, int(round(hours * 60)))
        return f"about {minutes} minute{'s' if minutes != 1 else ''}"
    if hours < 24:
        rounded_hours = int(round(hours))
        return f"about {rounded_hours} hour{'s' if rounded_hours != 1 else ''}"

    days = hours / 24.0
    if days < 7:
        rounded_days = int(round(days))
        return f"about {rounded_days} day{'s' if rounded_days != 1 else ''}"

    rounded_weeks = max(1, int(round(days / 7.0)))
    return f"about {rounded_weeks} week{'s' if rounded_weeks != 1 else ''}"


def _confidence_percent(insights: Dict[str, Any]) -> float:
    model_confidence = insights.get("model_confidence")
    if isinstance(model_confidence, (float, int)):
        return max(0.0, min(1.0, float(model_confidence))) * 100

    reliability = insights.get("data_reliability")
    if isinstance(reliability, (float, int)):
        return max(0.0, min(1.0, float(reliability))) * 100

    return 0.0


def _build_reason(
    best_day: str,
    best_channel: str,
    avg_response_time_hours: float,
    overall_reply_rate: float,
    total_interactions: int,
) -> str:
    if total_interactions == 0:
        return "No interaction history was provided for this lead, so recommendation confidence is low."

    if overall_reply_rate <= 0:
        return (
            f"This lead has not replied in the provided history. The recommendation favors {best_day} via "
            f"{best_channel} based on observed outreach attempts."
        )

    response_time_label = _humanize_duration(avg_response_time_hours)

    return (
        f"This lead replies most effectively on {best_day} and through {best_channel}. "
        f"Typical response time is {response_time_label} with a "
        f"{overall_reply_rate * 100:.1f}% reply rate in the provided history."
    )


def generate_recommendation(lead_id: str, insights: Dict[str, Any]) -> Dict[str, Any]:
    best_day = str(insights.get("best_day", "Monday"))
    best_channel = str(insights.get("best_channel", "email"))
    recommended_day = str(insights.get("recommended_day", best_day))
    recommended_hour = int(insights.get("recommended_hour_24", insights.get("usual_reply_hour", 10)))
    recommended_channel = str(insights.get("recommended_channel", best_channel))

    avg_response_time_hours = float(insights.get("avg_response_time_hours", 0.0))
    overall_reply_rate = float(insights.get("overall_reply_rate", 0.0))
    model_used = str(insights.get("model_used", "rule_based"))
    total_interactions = int(insights.get("total_interactions", 0))

    confidence_value = _confidence_percent(insights)
    best_time_label = f"{_format_hour_label(recommended_hour)} ({_time_bucket(recommended_hour)})"
    model_label = "ML" if model_used == "logistic_regression" else "Rule-based"

    reason = _build_reason(
        best_day=best_day,
        best_channel=best_channel,
        avg_response_time_hours=avg_response_time_hours,
        overall_reply_rate=overall_reply_rate,
        total_interactions=total_interactions,
    )

    return {
        "lead_id": str(lead_id),
        "best_day": recommended_day,
        "best_time": best_time_label,
        "best_channel": recommended_channel,
        "confidence": f"{confidence_value:.1f}%",
        "model": model_label,
        "reason": reason,
    }