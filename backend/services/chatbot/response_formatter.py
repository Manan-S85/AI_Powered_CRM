"""Human-readable response formatting for chatbot tool outputs."""

from __future__ import annotations

from typing import Any, Dict



def _format_probability_label(probability: str | None) -> str:
    if not probability:
        return ""
    return f"{probability}-probability "



def format_success(tool: str, arguments: Dict[str, Any], result: Dict[str, Any]) -> str:
    if tool == "get_leads":
        count = int(result.get("count", 0))
        probability = _format_probability_label(arguments.get("probability"))
        date_range = arguments.get("date_range")
        range_label = f" from {date_range.replace('_', ' ')}" if date_range else ""
        return f"Found {count} {probability}leads{range_label}."

    if tool == "add_lead":
        prediction = result.get("prediction", {})
        temperature = prediction.get("predicted_temperature", "Unknown")
        confidence = float(prediction.get("confidence", 0.0)) * 100
        return f"Lead added successfully with {temperature} classification ({confidence:.0f}% confidence)."

    if tool == "analyze_conversation":
        stored = bool(result.get("stored"))
        storage_text = "and stored in ai_insights" if stored else "but storage is unavailable"
        return f"Conversation analyzed successfully {storage_text}."

    if tool == "enrich_company":
        company = result.get("company", "Company")
        domain = result.get("domain") or "no domain"
        return f"Company enrichment completed for {company} using domain {domain}."

    if tool == "get_stats":
        ml_stats = result.get("ml_stats", {})
        total_leads = int(ml_stats.get("total_leads", 0))
        total_predictions = int(ml_stats.get("total_predictions", 0))
        return f"CRM stats ready: {total_leads} leads, {total_predictions} ML-scored records."

    return "Request completed successfully."



def format_error(code: str, message: str, detail: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "detail": detail or {},
        },
    }
