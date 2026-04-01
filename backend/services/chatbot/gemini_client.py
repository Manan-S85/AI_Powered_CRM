"""Gemini client for converting natural language queries into strict tool calls."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import requests
from dotenv import dotenv_values, load_dotenv

from .tool_schema import GEMINI_TOOL_CALL_SCHEMA, TOOL_DEFINITIONS

logger = logging.getLogger(__name__)

# Load environment variables from project root first, then default behavior.
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(_PROJECT_ROOT / ".env", override=True)
load_dotenv()


class GeminiClientError(RuntimeError):
    """Raised when Gemini cannot produce a valid tool call."""


class GeminiToolRouterClient:
    """Thin Gemini wrapper that enforces JSON-only tool call output."""

    def __init__(self) -> None:
        # Re-load .env at client construction to pick up latest runtime changes.
        load_dotenv(_PROJECT_ROOT / ".env", override=True)

        env_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        env_google_key = os.getenv("GOOGLE_API_KEY", "").strip()

        file_values = dotenv_values(_PROJECT_ROOT / ".env")
        file_api_key = str(file_values.get("GEMINI_API_KEY") or "").strip()
        file_google_key = str(file_values.get("GOOGLE_API_KEY") or "").strip()

        self.api_key = env_api_key or env_google_key or file_api_key or file_google_key
        configured_model = os.getenv("GEMINI_MODEL", "").strip()
        # Prefer high-throughput free-tier models when no explicit override is provided.
        self.models = [configured_model] if configured_model else [
            "gemini-3.1-flash-lite-preview",
            "gemini-3.1-flash-preview",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash",
            "gemini-2.5-flash",
        ]
        self.timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "30"))

        if not self.api_key:
            raise GeminiClientError(
                f"GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured. Checked {_PROJECT_ROOT / '.env'}"
            )

    def parse_tool_call(self, user_input: str, user_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        context_json = json.dumps(user_context or {}, ensure_ascii=True)
        tool_json = json.dumps(TOOL_DEFINITIONS, ensure_ascii=True)

        system_instruction = (
            "You are a strict CRM tool router. "
            "Return exactly one JSON object with fields: tool and arguments. "
            "Do not include markdown, prose, or extra fields."
        )

        prompt = (
            "You must choose one tool and extract only supported arguments.\\n"
            "Allowed tools and argument schemas:\\n"
            f"{tool_json}\\n"
            "Rules:\\n"
            "- If user asks to list/filter leads, use get_leads.\\n"
            "- If user asks to create/register a lead, use add_lead.\\n"
            "- If user asks to analyze transcript/chat/meeting notes, use analyze_conversation.\\n"
            "- If user asks for company/domain enrichment, use enrich_company.\\n"
            "- If user asks for summary metrics/stats/dashboard, use get_stats.\\n"
            "- Never invent unsupported keys.\\n"
            "- For missing optional fields, omit them.\\n"
            "- arguments must always be an object.\\n\\n"
            f"user_context: {context_json}\\n"
            f"user_input: {user_input}"
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "systemInstruction": {
                "role": "system",
                "parts": [{"text": system_instruction}],
            },
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_TOOL_CALL_SCHEMA,
            },
        }

        parsed = None
        last_error: Optional[str] = None

        for model in self.models:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                response = requests.post(
                    endpoint,
                    params={"key": self.api_key},
                    json=payload,
                    timeout=self.timeout_seconds,
                )
            except requests.RequestException as error:
                last_error = f"Gemini request failed for {model}: {error}"
                continue

            if response.status_code < 400:
                parsed = response.json()
                break

            last_error = f"Gemini API error for {model} ({response.status_code}): {response.text}"

            # Try next model only for model-unavailable or quota/rate-limit style failures.
            if response.status_code not in {404, 429, 503}:
                raise GeminiClientError(last_error)

        if parsed is None:
            raise GeminiClientError(last_error or "Gemini API call failed")

        text = self._extract_text(parsed)

        try:
            tool_call = json.loads(text)
        except json.JSONDecodeError as error:
            logger.error("Gemini returned non-JSON output: %s", text)
            raise GeminiClientError("Gemini did not return valid JSON") from error

        if not isinstance(tool_call, dict):
            raise GeminiClientError("Gemini JSON output must be an object")

        return tool_call

    @staticmethod
    def _extract_text(payload: Dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            raise GeminiClientError("Gemini returned no candidates")

        content = candidates[0].get("content") or {}
        parts = content.get("parts") or []

        for part in parts:
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                return text.strip()

        raise GeminiClientError("Gemini returned empty response content")
