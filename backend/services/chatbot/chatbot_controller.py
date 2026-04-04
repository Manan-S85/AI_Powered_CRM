"""Central chatbot controller for Gemini-driven CRM tool routing."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from .gemini_client import GeminiClientError, GeminiToolRouterClient
from .response_formatter import format_error, format_success
from .validators import ValidationError, validate_tool_payload, validate_user_input
from .tools import add_lead, analyze_conversation, enrich_company, get_leads, get_stats

logger = logging.getLogger(__name__)

_TOOL_HANDLERS = {
    "get_leads": get_leads.execute,
    "add_lead": add_lead.execute,
    "analyze_conversation": analyze_conversation.execute,
    "enrich_company": enrich_company.execute,
    "get_stats": get_stats.execute,
}

_gemini_client = None



def _get_gemini_client() -> GeminiToolRouterClient:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiToolRouterClient()
    return _gemini_client



def _inject_follow_up_filters(tool: str, arguments: Dict[str, Any], user_context: Dict[str, Any]) -> Dict[str, Any]:
    if tool != "get_leads":
        return arguments

    memory = user_context.get("conversation_memory") if isinstance(user_context, dict) else None
    if not isinstance(memory, dict):
        return arguments

    previous_filters = memory.get("last_get_leads_filters")
    if not isinstance(previous_filters, dict):
        return arguments

    merged = dict(arguments)
    if "probability" not in merged and previous_filters.get("probability"):
        merged["probability"] = previous_filters["probability"]
    if "date_range" not in merged and previous_filters.get("date_range"):
        merged["date_range"] = previous_filters["date_range"]
    return merged


def _normalize_get_leads_arguments(user_input: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Patch common model extraction mistakes for get_leads arguments."""
    merged = dict(arguments)

    role_value = merged.get("role_position")
    if isinstance(role_value, str):
        role_lower = role_value.strip().lower()
        if role_lower in {"last_7_days", "last_30_days"} and "date_range" not in merged:
            merged["date_range"] = role_lower
        if role_lower in {"high", "medium", "low"} and "probability" not in merged:
            merged["probability"] = role_lower

    normalized_input = user_input.lower()
    if "date_range" not in merged:
        if "last 30 day" in normalized_input:
            merged["date_range"] = "last_30_days"
        elif "last 7 day" in normalized_input:
            merged["date_range"] = "last_7_days"

    if "probability" not in merged:
        if "high probability" in normalized_input:
            merged["probability"] = "high"
        elif "medium probability" in normalized_input:
            merged["probability"] = "medium"
        elif "low probability" in normalized_input:
            merged["probability"] = "low"

    if "name" not in merged or not str(merged.get("name") or "").strip():
        # Heuristic for prompts like "get me details of Rahul Sharma".
        markers = ["details of", "details for", "about", "profile of"]
        lowered = user_input.lower()
        for marker in markers:
            if marker in lowered:
                extracted = user_input[lowered.find(marker) + len(marker):].strip(" .,!?")
                if extracted and len(extracted.split()) <= 6:
                    merged["name"] = extracted
                    break

    # Keep only keys supported by get_leads.
    allowed_keys = {
        "probability",
        "date_range",
        "name",
        "email",
        "unique_id",
        "role_position",
        "limit",
    }
    merged = {key: value for key, value in merged.items() if key in allowed_keys}

    # Models sometimes mirror the name into role_position; avoid over-constraining the query.
    if (
        isinstance(merged.get("name"), str)
        and isinstance(merged.get("role_position"), str)
        and merged["name"].strip().lower() == merged["role_position"].strip().lower()
    ):
        merged.pop("role_position", None)

    return merged



def _update_conversation_memory(tool: str, arguments: Dict[str, Any], user_context: Dict[str, Any]) -> None:
    if not isinstance(user_context, dict):
        return

    memory = user_context.setdefault("conversation_memory", {})
    if not isinstance(memory, dict):
        return

    if tool == "get_leads":
        memory["last_get_leads_filters"] = {
            "probability": arguments.get("probability"),
            "date_range": arguments.get("date_range"),
        }



def handle_chat_request(user_input: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
    """Handle a user chat request and execute one CRM tool safely."""
    try:
        normalized_input = validate_user_input(user_input)

        gemini_client = _get_gemini_client()
        tool_payload = gemini_client.parse_tool_call(normalized_input, user_context)

        # Pre-normalize common extraction mistakes before strict validation.
        if isinstance(tool_payload, dict) and tool_payload.get("tool") == "get_leads":
            raw_arguments = tool_payload.get("arguments")
            if isinstance(raw_arguments, dict):
                tool_payload = {
                    **tool_payload,
                    "arguments": _normalize_get_leads_arguments(normalized_input, raw_arguments),
                }

        validated_payload = validate_tool_payload(tool_payload)
        tool = validated_payload["tool"]
        arguments = validated_payload["arguments"]

        arguments = _inject_follow_up_filters(tool, arguments, user_context)

        # Revalidate after context merge to preserve the same security guarantees.
        validated_payload = validate_tool_payload({"tool": tool, "arguments": arguments})
        arguments = validated_payload["arguments"]

        if tool == "general_assistant":
            inferred_lookup_args = _normalize_get_leads_arguments(normalized_input, {})
            if any(
                inferred_lookup_args.get(key)
                for key in ["name", "email", "unique_id", "role_position"]
            ):
                # Route person/detail lookups to structured CRM data query.
                lead_lookup_payload = validate_tool_payload(
                    {"tool": "get_leads", "arguments": inferred_lookup_args}
                )
                lead_lookup_args = _inject_follow_up_filters(
                    "get_leads", lead_lookup_payload["arguments"], user_context
                )
                lead_lookup_payload = validate_tool_payload(
                    {"tool": "get_leads", "arguments": lead_lookup_args}
                )
                lead_lookup_args = lead_lookup_payload["arguments"]

                raw_result = get_leads.execute(lead_lookup_args)
                _update_conversation_memory("get_leads", lead_lookup_args, user_context)
                return {
                    "success": True,
                    "tool": "get_leads",
                    "arguments": lead_lookup_args,
                    "data": raw_result,
                    "message": format_success("get_leads", lead_lookup_args, raw_result),
                }

            general_answer = gemini_client.answer_general_question(normalized_input, user_context)
            return {
                "success": True,
                "tool": "general_assistant",
                "arguments": {},
                "data": {
                    "answer": general_answer,
                    "conversation_memory": user_context.get("conversation_memory", {}),
                },
                "message": general_answer,
            }

        handler = _TOOL_HANDLERS.get(tool)
        if handler is None:
            return format_error("TOOL_NOT_IMPLEMENTED", f"Tool {tool} is not implemented")

        raw_result = handler(arguments)
        _update_conversation_memory(tool, arguments, user_context)

        return {
            "success": True,
            "tool": tool,
            "arguments": arguments,
            "data": raw_result,
            "message": format_success(tool, arguments, raw_result),
        }

    except ValidationError as error:
        # For broad/general questions, degrade gracefully to a conversational response
        # instead of failing with schema-only errors.
        try:
            gemini_client = _get_gemini_client()
            general_answer = gemini_client.answer_general_question(user_input, user_context)
            memory = user_context.get("conversation_memory", {}) if isinstance(user_context, dict) else {}
            return {
                "success": True,
                "tool": "general_assistant",
                "arguments": {},
                "data": {"conversation_memory": memory},
                "message": general_answer,
            }
        except Exception:
            return format_error("VALIDATION_ERROR", str(error))
    except GeminiClientError as error:
        return format_error("GEMINI_ERROR", str(error))
    except Exception as error:
        logger.exception("Unhandled chatbot error")
        return format_error("INTERNAL_ERROR", "Failed to process chat request", {"reason": str(error)})


async def handle_chat_request_async(user_input: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
    """Async wrapper for FastAPI routes that want non-blocking dispatch."""
    return await asyncio.to_thread(handle_chat_request, user_input, user_context)
