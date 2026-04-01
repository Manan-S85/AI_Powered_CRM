"""Tool implementation for conversation insights generation."""

from __future__ import annotations

import base64
import importlib.util
from pathlib import Path
from typing import Any, Dict, Optional

_MAX_FILE_BYTES = 2 * 1024 * 1024



def _get_ai_insights_service():
    service_dir = Path(__file__).resolve().parents[2]
    main_file = service_dir / "main.py"
    spec = importlib.util.spec_from_file_location("chatbot_main_service", str(main_file))
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load main service from {main_file}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    get_ai_insights_service = getattr(module, "get_ai_insights_service")

    return get_ai_insights_service()



def _decode_file_payload(file_content_base64: Optional[str]) -> Optional[bytes]:
    if not file_content_base64:
        return None

    try:
        decoded = base64.b64decode(file_content_base64, validate=True)
    except Exception as error:
        raise ValueError(f"Invalid base64 file content: {error}") from error

    if len(decoded) > _MAX_FILE_BYTES:
        raise ValueError("Uploaded file content exceeds 2 MB limit")

    return decoded



def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
    service = _get_ai_insights_service()

    source_type = arguments["source_type"]
    conversation_text = arguments.get("conversation_text")
    file_name = arguments.get("file_name")
    file_bytes = _decode_file_payload(arguments.get("file_content_base64"))

    if not conversation_text and not file_bytes:
        raise ValueError("Provide conversation_text or file_content_base64")

    result = service.generate_and_store(
        source_type=source_type,
        conversation_text=conversation_text,
        file_name=file_name,
        file_bytes=file_bytes,
    )

    return {
        "record_id": result.get("record_id"),
        "stored": bool(result.get("stored")),
        "insights": result.get("insights", {}),
    }
