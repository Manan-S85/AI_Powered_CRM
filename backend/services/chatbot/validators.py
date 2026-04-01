"""Validation and sanitization utilities for chatbot tool calls."""

from __future__ import annotations

from typing import Any, Dict

from .tool_schema import TOOL_NAMES, TOOL_PARAMETERS_BY_NAME

_MAX_USER_INPUT_LENGTH = 3000
_MAX_QUERY_LIMIT = 50


class ValidationError(ValueError):
    """Raised when a user or tool payload fails validation."""



def validate_user_input(user_input: Any) -> str:
    if not isinstance(user_input, str):
        raise ValidationError("user_input must be a string")

    normalized = user_input.strip()
    if not normalized:
        raise ValidationError("user_input cannot be empty")

    if len(normalized) > _MAX_USER_INPUT_LENGTH:
        raise ValidationError(f"user_input exceeds max length of {_MAX_USER_INPUT_LENGTH}")

    return normalized



def _reject_dangerous_key(key: str) -> None:
    if "$" in key or "." in key:
        raise ValidationError(f"invalid key: {key}")



def _sanitize_value(value: Any) -> Any:
    if isinstance(value, dict):
        sanitized: Dict[str, Any] = {}
        for key, nested_value in value.items():
            if not isinstance(key, str):
                raise ValidationError("all object keys must be strings")
            _reject_dangerous_key(key)
            sanitized[key] = _sanitize_value(nested_value)
        return sanitized

    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]

    if isinstance(value, str):
        return value.strip()

    if isinstance(value, (bool, int, float)) or value is None:
        return value

    raise ValidationError("unsupported argument type")



def validate_tool_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError("tool payload must be an object")

    tool = payload.get("tool")
    arguments = payload.get("arguments", {})

    if tool not in TOOL_NAMES:
        raise ValidationError(f"unsupported tool: {tool}")

    if not isinstance(arguments, dict):
        raise ValidationError("arguments must be an object")

    _reject_dangerous_key("tool")
    sanitized_arguments = _sanitize_value(arguments)

    schema = TOOL_PARAMETERS_BY_NAME[tool]
    allowed_keys = set(schema.get("properties", {}).keys())
    required_keys = set(schema.get("required", []))

    unknown_keys = sorted(set(sanitized_arguments.keys()) - allowed_keys)
    if unknown_keys:
        raise ValidationError(f"unknown argument(s) for {tool}: {', '.join(unknown_keys)}")

    missing_keys = sorted(k for k in required_keys if sanitized_arguments.get(k) in (None, ""))
    if missing_keys:
        raise ValidationError(f"missing required argument(s): {', '.join(missing_keys)}")

    if "limit" in sanitized_arguments:
        limit = sanitized_arguments["limit"]
        if not isinstance(limit, int):
            raise ValidationError("limit must be an integer")
        if limit < 1 or limit > _MAX_QUERY_LIMIT:
            raise ValidationError(f"limit must be between 1 and {_MAX_QUERY_LIMIT}")

    if "probability" in sanitized_arguments and sanitized_arguments["probability"]:
        allowed_probability = {"high", "medium", "low"}
        probability = str(sanitized_arguments["probability"]).lower()
        if probability not in allowed_probability:
            raise ValidationError("probability must be one of: high, medium, low")
        sanitized_arguments["probability"] = probability

    if "date_range" in sanitized_arguments and sanitized_arguments["date_range"]:
        allowed_ranges = {"last_7_days", "last_30_days"}
        date_range = str(sanitized_arguments["date_range"]).lower()
        if date_range not in allowed_ranges:
            raise ValidationError("date_range must be one of: last_7_days, last_30_days")
        sanitized_arguments["date_range"] = date_range

    return {"tool": tool, "arguments": sanitized_arguments}
