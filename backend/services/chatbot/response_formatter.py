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
        identity_filters = [
            arguments.get("name"),
            arguments.get("email"),
            arguments.get("unique_id"),
            arguments.get("role_position"),
        ]
        has_identity_filter = any(identity_filters)

        if has_identity_filter and count == 0:
            return "No matching lead found for the requested details."

        if has_identity_filter and count > 0:
            lead = (result.get("leads") or [{}])[0]
            lead_name = lead.get("name", "Unknown")
            lead_email = lead.get("email", "N/A")
            lead_role = lead.get("role_position", "N/A")
            lead_location = lead.get("location", "N/A")
            prediction = lead.get("ml_prediction") or {}
            temp = prediction.get("predicted_temperature", "Unknown")
            confidence = float(prediction.get("confidence", 0.0)) * 100
            return (
                f"Top match: {lead_name} ({lead_email}), {lead_role}, {lead_location}. "
                f"Lead score: {temp} ({confidence:.0f}% confidence)."
            )

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
        domain = result.get("domain") or "unavailable"
        website = result.get("website") or "not provided"
        quality = str(result.get("enrichment_quality") or "unknown").upper()

        intelligence = result.get("intelligence") if isinstance(result.get("intelligence"), dict) else {}
        industry = str(intelligence.get("industry") or "Unknown")
        company_size = str(intelligence.get("estimated_company_size") or "Unknown")
        summary = str(intelligence.get("summary") or "No summary generated.")

        decision_makers = intelligence.get("decision_makers")
        if isinstance(decision_makers, list):
            decision_makers_text = ", ".join([str(item).strip() for item in decision_makers if str(item).strip()])
        else:
            decision_makers_text = ""
        if not decision_makers_text:
            decision_makers_text = "Not identified"

        recommendations = result.get("recommendations")
        recommendations_text = ""
        if isinstance(recommendations, list) and recommendations:
            cleaned = [str(item).strip() for item in recommendations if str(item).strip()]
            if cleaned:
                recommendations_text = "\nNext steps: " + " | ".join(cleaned)

        return (
            f"Company intelligence for {company}\n"
            f"Domain: {domain} | Website: {website} | Quality: {quality}\n"
            f"Industry: {industry}\n"
            f"Estimated size: {company_size}\n"
            f"Decision makers: {decision_makers_text}\n"
            f"Summary: {summary}"
            f"{recommendations_text}"
        )

    if tool == "get_stats":
        ml_stats = result.get("ml_stats", {})
        total_leads = int(ml_stats.get("total_leads", 0))
        total_predictions = int(ml_stats.get("total_predictions", 0))
        return f"CRM stats ready: {total_leads} leads, {total_predictions} ML-scored records."

    if tool == "general_assistant":
        return str(result.get("answer", "I am here to help with your CRM questions."))

    return "Request completed successfully."



def format_error(code: str, message: str, detail: Dict[str, Any] | None = None) -> Dict[str, Any]:
    return {
        "success": False,
        "message": message,
        "error": {
            "code": code,
            "message": message,
            "detail": detail or {},
        },
    }
