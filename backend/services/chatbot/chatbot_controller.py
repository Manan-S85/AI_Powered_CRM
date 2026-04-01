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

        validated_payload = validate_tool_payload(tool_payload)
        tool = validated_payload["tool"]
        arguments = _inject_follow_up_filters(tool, validated_payload["arguments"], user_context)

        # Revalidate after context merge to preserve the same security guarantees.
        validated_payload = validate_tool_payload({"tool": tool, "arguments": arguments})
        arguments = validated_payload["arguments"]

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
        return format_error("VALIDATION_ERROR", str(error))
    except GeminiClientError as error:
        return format_error("GEMINI_ERROR", str(error))
    except Exception as error:
        logger.exception("Unhandled chatbot error")
        return format_error("INTERNAL_ERROR", "Failed to process chat request", {"reason": str(error)})


async def handle_chat_request_async(user_input: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
    """Async wrapper for FastAPI routes that want non-blocking dispatch."""
    return await asyncio.to_thread(handle_chat_request, user_input, user_context)
