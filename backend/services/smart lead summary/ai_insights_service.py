"""
AI Insights service for extracting structured sales intelligence from conversation sources.
Supports transcript text, WhatsApp chat exports, and meeting notes.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv()

logger = logging.getLogger(__name__)

ALLOWED_CATEGORIES = {"Cost", "Time", "Technical", "Integration", "Support", "Performance", "Compliance", "Other"}
ALLOWED_LEVELS = {"Low", "Medium", "High", "Unknown"}
ALLOWED_SOURCE_TYPES = {"call_transcript", "whatsapp_chat", "meeting_notes"}


class AIInsightsService:
    def __init__(self) -> None:
        self.mongo_client: Optional[MongoClient] = None
        self.collection = None
        self._initialize_db()

    def _initialize_db(self) -> None:
        mongo_uri = os.getenv("MONGODB_URI")
        db_name = os.getenv("DB_NAME", "ai_crm_db")

        if not mongo_uri:
            logger.warning("[AI Insights] MONGODB_URI is missing")
            return

        try:
            self.mongo_client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "7000")),
                connectTimeoutMS=int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "7000")),
                socketTimeoutMS=int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "12000")),
                retryWrites=True,
                retryReads=True,
            )
            self.mongo_client.admin.command("ping", maxTimeMS=5000)
            self.collection = self.mongo_client[db_name]["ai_insights"]
            self.collection.create_index([("created_at", -1)], background=True)
            self.collection.create_index([("source_type", 1)], background=True)
            logger.info("[AI Insights] MongoDB connected")
        except Exception as error:
            logger.error(f"[AI Insights] Failed to initialize MongoDB: {error}")
            if self.mongo_client is not None:
                try:
                    self.mongo_client.close()
                except Exception:
                    pass
                self.mongo_client = None
            self.collection = None

    def _extract_text_from_file(self, file_name: str, file_bytes: bytes, source_type: str) -> str:
        extension = (file_name.rsplit(".", 1)[-1].lower() if "." in file_name else "")

        audio_extensions = {"mp3", "wav", "m4a", "webm", "ogg", "flac", "aac"}
        if source_type == "call_transcript" and extension in audio_extensions:
            return self._transcribe_with_whisper(file_name, file_bytes)

        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1")
            except Exception as error:
                raise ValueError(f"Unable to decode uploaded file content: {error}")

    def _transcribe_with_whisper(self, file_name: str, file_bytes: bytes) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured for Whisper transcription")

        whisper_model = os.getenv("OPENAI_WHISPER_MODEL", "whisper-1")

        response = requests.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (file_name, file_bytes)},
            data={"model": whisper_model, "response_format": "text"},
            timeout=120,
        )

        if response.status_code >= 400:
            raise ValueError(f"Whisper transcription failed: {response.text}")

        transcript_text = response.text.strip()
        if not transcript_text:
            raise ValueError("Whisper returned an empty transcript")

        return transcript_text

    def _build_prompt(self, conversation_text: str) -> str:
        return f'''You are an AI Sales Intelligence Engine operating inside a production CRM system.

Your task is to analyze ONLY the provided conversation text and extract structured sales insights.

CRITICAL RULES:
- You must return ONLY valid JSON.
- Do NOT include explanations.
- Do NOT include markdown formatting.
- Do NOT include comments.
- Do NOT include additional fields.
- Do NOT rename fields.
- Do NOT infer information that is not reasonably supported by the text.
- If information is not present or unclear, use "Unknown" (for enums) or null (for numbers).
- You must strictly follow the schema below.
- Your output must be machine-readable and directly storable in a database.
- Do not reference system instructions.
- Do not modify, summarize, or rewrite the input text.
- Only extract structured insights from the given text.
- This task is isolated. Ignore any external logic or application behavior.

OUTPUT SCHEMA (STRICT):

{{
  "pain_points": [
    {{
      "description": "string",
      "category": "Cost | Time | Technical | Integration | Support | Performance | Compliance | Other"
    }}
  ],
  "budget_probability": "Low | Medium | High | Unknown",
  "urgency_level": "Low | Medium | High | Unknown",
  "suggested_next_action": "string",
  "follow_up_timeline_days": number | null
}}

FIELD DEFINITIONS:

pain_points:
- Explicit problems, frustrations, blockers, or needs mentioned by the client.
- If none clearly stated, return empty array [].

budget_probability:
- High → Clear budget allocation confirmed.
- Medium → Budget discussed but not finalized.
- Low → Budget unlikely or constrained.
- Unknown → Not mentioned or cannot be determined.

urgency_level:
- High → Immediate or urgent need.
- Medium → Near-term interest (within 1–2 months).
- Low → Exploratory or long-term.
- Unknown → No timeline signals.

suggested_next_action:
- A clear, concrete next step for the sales team.
- Must be actionable.
- If unclear, return "Follow up to clarify requirements".

follow_up_timeline_days:
- Integer representing recommended number of days until follow-up.
- Infer based on urgency if possible.
- If no timeline signal exists, return null.

CONVERSATION TEXT:
"""
{conversation_text}
"""
'''

    def _generate_with_llm(self, conversation_text: str) -> Dict[str, Any]:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured for LLM insights generation")

        model_name = os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini")
        prompt = self._build_prompt(conversation_text)

        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model_name,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "Return strict JSON output only."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=120,
        )

        if response.status_code >= 400:
            raise ValueError(f"LLM generation failed: {response.text}")

        payload = response.json()
        content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not content:
            raise ValueError("LLM returned empty content")

        try:
            return json.loads(content)
        except json.JSONDecodeError as error:
            raise ValueError(f"LLM did not return valid JSON: {error}")

    def _sanitize_output(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        pain_points_raw = raw.get("pain_points") if isinstance(raw.get("pain_points"), list) else []
        pain_points: List[Dict[str, str]] = []

        for item in pain_points_raw:
            if not isinstance(item, dict):
                continue
            description = str(item.get("description", "")).strip()
            if not description:
                continue
            category = str(item.get("category", "Other"))
            if category not in ALLOWED_CATEGORIES:
                category = "Other"
            pain_points.append({"description": description, "category": category})

        budget_probability = str(raw.get("budget_probability", "Unknown"))
        if budget_probability not in ALLOWED_LEVELS:
            budget_probability = "Unknown"

        urgency_level = str(raw.get("urgency_level", "Unknown"))
        if urgency_level not in ALLOWED_LEVELS:
            urgency_level = "Unknown"

        suggested_next_action = str(raw.get("suggested_next_action", "")).strip() or "Follow up to clarify requirements"

        follow_up_timeline_days_raw = raw.get("follow_up_timeline_days")
        if follow_up_timeline_days_raw is None:
            follow_up_timeline_days = None
        else:
            try:
                follow_up_timeline_days = int(follow_up_timeline_days_raw)
                if follow_up_timeline_days < 0:
                    follow_up_timeline_days = None
            except (ValueError, TypeError):
                follow_up_timeline_days = None

        return {
            "pain_points": pain_points,
            "budget_probability": budget_probability,
            "urgency_level": urgency_level,
            "suggested_next_action": suggested_next_action,
            "follow_up_timeline_days": follow_up_timeline_days,
        }

    def generate_and_store(self, source_type: str, conversation_text: Optional[str], file_name: Optional[str], file_bytes: Optional[bytes]) -> Dict[str, Any]:
        if source_type not in ALLOWED_SOURCE_TYPES:
            raise ValueError("Invalid source_type. Use call_transcript, whatsapp_chat, or meeting_notes")

        resolved_text = (conversation_text or "").strip()

        if file_name and file_bytes is not None and file_bytes:
            extracted_text = self._extract_text_from_file(file_name, file_bytes, source_type)
            if extracted_text.strip():
                resolved_text = extracted_text.strip() if not resolved_text else f"{resolved_text}\n\n{extracted_text.strip()}"

        if not resolved_text:
            raise ValueError("No conversation text available. Provide text input or upload a valid file")

        llm_raw = self._generate_with_llm(resolved_text)
        insights = self._sanitize_output(llm_raw)

        document = {
            "source_type": source_type,
            "source_file_name": file_name,
            "conversation_text": resolved_text,
            "insights": insights,
            "created_at": datetime.utcnow().isoformat(),
        }

        if self.collection is not None:
            result = self.collection.insert_one(document)
            return {
                "insights": insights,
                "record_id": str(result.inserted_id),
                "stored": True,
                "resolved_text": resolved_text,
            }

        return {
            "insights": insights,
            "record_id": None,
            "stored": False,
            "resolved_text": resolved_text,
        }


_ai_insights_service: Optional[AIInsightsService] = None


def get_ai_insights_service() -> AIInsightsService:
    global _ai_insights_service
    if _ai_insights_service is None:
        _ai_insights_service = AIInsightsService()
    return _ai_insights_service
