"""
Conversation Intelligence service for CRM interactions.
This module is intentionally self-contained so it can be loaded dynamically from
an existing folder that contains spaces in its path.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


load_dotenv()
logger = logging.getLogger(__name__)

ALLOWED_SOURCE_TYPES = {
    "chat_message",
    "email",
    "call_transcript",
    "meeting_notes",
    "whatsapp_chat",
}
ALLOWED_SENTIMENTS = {"positive", "neutral", "negative"}
ALLOWED_INTENTS = {
    "interested",
    "neutral",
    "objection",
    "competitor_evaluation",
    "buying_signal",
}


@dataclass
class ScoringConfig:
    positive_sentiment_bonus: int
    negative_sentiment_penalty: int
    objection_penalty_per_item: int
    competitor_penalty_per_item: int
    low_engagement_threshold: int
    engagement_weight: float
    balance_weight: float
    quality_weight: float

    @classmethod
    def from_env(cls) -> "ScoringConfig":
        return cls(
            positive_sentiment_bonus=int(os.getenv("CONV_POSITIVE_SENTIMENT_BONUS", "10")),
            negative_sentiment_penalty=int(os.getenv("CONV_NEGATIVE_SENTIMENT_PENALTY", "15")),
            objection_penalty_per_item=int(os.getenv("CONV_OBJECTION_PENALTY", "8")),
            competitor_penalty_per_item=int(os.getenv("CONV_COMPETITOR_PENALTY", "10")),
            low_engagement_threshold=int(os.getenv("CONV_LOW_ENGAGEMENT_THRESHOLD", "40")),
            engagement_weight=float(os.getenv("CONV_REP_ENGAGEMENT_WEIGHT", "0.35")),
            balance_weight=float(os.getenv("CONV_REP_BALANCE_WEIGHT", "0.35")),
            quality_weight=float(os.getenv("CONV_REP_QUALITY_WEIGHT", "0.30")),
        )


class ConversationIntelligenceService:
    """Analyzes conversations, computes scores, and stores insights."""

    def __init__(self) -> None:
        self.mongo_client: Optional[MongoClient] = None
        self.collection = None
        self.leads_collection = None
        self.scoring_config = ScoringConfig.from_env()
        self.intent_base_scores = {
            "buying_signal": 90,
            "interested": 75,
            "neutral": 52,
            "competitor_evaluation": 42,
            "objection": 30,
        }
        self._initialize_db()

    def _initialize_db(self) -> None:
        mongo_uri = os.getenv("MONGODB_URI")
        db_name = os.getenv("DB_NAME", "ai_crm_db")

        if not mongo_uri:
            logger.warning("[Conversation Intelligence] MONGODB_URI is missing")
            return

        try:
            self.mongo_client = MongoClient(
                mongo_uri,
                serverSelectionTimeoutMS=int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "7000")),
                connectTimeoutMS=int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "7000")),
                socketTimeoutMS=int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "12000")),
                retryWrites=True,
                retryReads=True,
                maxPoolSize=20,
                minPoolSize=0,
            )
            self.mongo_client.admin.command("ping", maxTimeMS=5000)

            database = self.mongo_client[db_name]
            self.collection = database["conversation_intelligence"]
            self.leads_collection = database["leads"]

            self.collection.create_index([("lead_id", 1), ("analyzed_at", -1)], background=True)
            self.collection.create_index([("risk.label", 1), ("analyzed_at", -1)], background=True)
            self.collection.create_index([("source_type", 1), ("analyzed_at", -1)], background=True)
            logger.info("[Conversation Intelligence] MongoDB connected")
        except Exception as error:
            logger.error(f"[Conversation Intelligence] MongoDB init failed: {error}")
            if self.mongo_client is not None:
                try:
                    self.mongo_client.close()
                except Exception:
                    pass
            self.mongo_client = None
            self.collection = None
            self.leads_collection = None

    async def analyze_conversation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        normalized_payload = self._normalize_payload(payload)

        source_type = normalized_payload["source_type"]
        lead_id = normalized_payload.get("lead_id")
        conversation_id = normalized_payload.get("conversation_id")
        metadata = normalized_payload.get("metadata") or {}
        persist = bool(normalized_payload.get("persist", True))

        messages = normalized_payload.get("messages") or []
        text_from_messages = self._messages_to_text(messages)
        conversation_text = normalized_payload.get("conversation_text", "").strip()

        hydration_meta: Dict[str, Any] = {}
        if not conversation_text and not text_from_messages and lead_id:
            hydrated_text, hydration_meta = await self._hydrate_text_from_lead(lead_id)
            conversation_text = hydrated_text

        merged_text = conversation_text
        if text_from_messages:
            merged_text = f"{conversation_text}\n\n{text_from_messages}".strip() if conversation_text else text_from_messages

        if not merged_text:
            raise ValueError("No conversation data found. Provide conversation_text, messages, or a valid lead_id")

        ai_analysis = await self._analyze_with_ai(merged_text, source_type, messages)
        scores = self._compute_scores(ai_analysis, messages, merged_text)
        risk = self._detect_risk(ai_analysis, scores)

        output = {
            "source_type": source_type,
            "lead_id": lead_id,
            "conversation_id": conversation_id,
            "analysis": ai_analysis,
            "scores": scores,
            "risk": risk,
            "insights": {
                "key_insights": ai_analysis.get("key_insights", []),
                "objections": ai_analysis.get("objections", []),
                "competitor_mentions": ai_analysis.get("competitor_mentions", []),
            },
            "metadata": {**metadata, **hydration_meta},
            "analyzed_at": datetime.utcnow().isoformat(),
        }

        if persist and self.collection is not None:
            output["stored"] = True
            output["record_id"] = await self._store_record(output, merged_text)
        else:
            output["stored"] = False
            output["record_id"] = None

        return output

    async def get_latest_for_lead(self, lead_id: str) -> Optional[Dict[str, Any]]:
        if not lead_id:
            return None

        if self.collection is None:
            return None

        def _query() -> Optional[Dict[str, Any]]:
            return self.collection.find_one({"lead_id": lead_id}, sort=[("analyzed_at", -1)])

        record = await asyncio.to_thread(_query)
        if record is None:
            return None

        if "_id" in record:
            record["_id"] = str(record["_id"])

        return record

    async def get_overview(self, limit: int = 200) -> Dict[str, Any]:
        if self.collection is None:
            return {
                "total_analyzed": 0,
                "average_client_intent_score": 0,
                "average_rep_performance_score": 0,
                "risk_distribution": {"Deal at Risk": 0, "Moderate Risk": 0, "Healthy Deal": 0},
                "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
                "intent_distribution": {
                    "interested": 0,
                    "neutral": 0,
                    "objection": 0,
                    "competitor_evaluation": 0,
                    "buying_signal": 0,
                },
                "generated_at": datetime.utcnow().isoformat(),
            }

        def _fetch() -> List[Dict[str, Any]]:
            cursor = (
                self.collection
                .find({}, {"analysis": 1, "scores": 1, "risk": 1})
                .sort("analyzed_at", -1)
                .limit(max(1, min(limit, 2000)))
            )
            return list(cursor)

        records = await asyncio.to_thread(_fetch)

        risk_distribution = {"Deal at Risk": 0, "Moderate Risk": 0, "Healthy Deal": 0}
        sentiment_distribution = {"positive": 0, "neutral": 0, "negative": 0}
        intent_distribution = {
            "interested": 0,
            "neutral": 0,
            "objection": 0,
            "competitor_evaluation": 0,
            "buying_signal": 0,
        }

        total_intent_score = 0
        total_rep_score = 0

        for record in records:
            analysis = record.get("analysis") or {}
            scores = record.get("scores") or {}
            risk = record.get("risk") or {}

            sentiment = analysis.get("sentiment", "neutral")
            intent = analysis.get("client_intent", "neutral")
            risk_label = risk.get("label", "Moderate Risk")

            if sentiment not in sentiment_distribution:
                sentiment = "neutral"
            if intent not in intent_distribution:
                intent = "neutral"
            if risk_label not in risk_distribution:
                risk_label = "Moderate Risk"

            sentiment_distribution[sentiment] += 1
            intent_distribution[intent] += 1
            risk_distribution[risk_label] += 1

            total_intent_score += int(scores.get("client_intent_score", 0))
            total_rep_score += int(scores.get("sales_rep_performance_score", 0))

        total = len(records)
        avg_intent = round(total_intent_score / total, 2) if total else 0
        avg_rep = round(total_rep_score / total, 2) if total else 0

        return {
            "total_analyzed": total,
            "average_client_intent_score": avg_intent,
            "average_rep_performance_score": avg_rep,
            "risk_distribution": risk_distribution,
            "sentiment_distribution": sentiment_distribution,
            "intent_distribution": intent_distribution,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def _normalize_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        source_type = str(payload.get("source_type") or "chat_message").strip().lower()
        if source_type not in ALLOWED_SOURCE_TYPES:
            raise ValueError("Invalid source_type. Use chat_message, email, call_transcript, meeting_notes, or whatsapp_chat")

        messages = payload.get("messages")
        if messages is not None and not isinstance(messages, list):
            raise ValueError("messages must be a list when provided")

        metadata = payload.get("metadata") or {}
        if not isinstance(metadata, dict):
            raise ValueError("metadata must be an object")

        return {
            "source_type": source_type,
            "lead_id": (str(payload.get("lead_id")).strip() if payload.get("lead_id") is not None else None),
            "conversation_id": (str(payload.get("conversation_id")).strip() if payload.get("conversation_id") is not None else None),
            "conversation_text": str(payload.get("conversation_text") or "").strip(),
            "messages": messages or [],
            "metadata": metadata,
            "persist": payload.get("persist", True),
        }

    def _messages_to_text(self, messages: List[Any]) -> str:
        lines: List[str] = []
        for message in messages:
            if isinstance(message, str):
                if message.strip():
                    lines.append(message.strip())
                continue

            if not isinstance(message, dict):
                continue

            speaker = str(
                message.get("speaker")
                or message.get("role")
                or message.get("sender")
                or message.get("author")
                or "participant"
            ).strip()

            text = str(
                message.get("text")
                or message.get("content")
                or message.get("message")
                or message.get("body")
                or ""
            ).strip()

            if text:
                lines.append(f"{speaker}: {text}")

        return "\n".join(lines).strip()

    async def _hydrate_text_from_lead(self, lead_id: str) -> Tuple[str, Dict[str, Any]]:
        if self.leads_collection is None:
            return "", {}

        def _fetch_lead() -> Optional[Dict[str, Any]]:
            lead = self.leads_collection.find_one({"unique_id": lead_id})
            if lead is not None:
                return lead
            try:
                return self.leads_collection.find_one({"_id": ObjectId(lead_id)})
            except Exception:
                return None

        lead = await asyncio.to_thread(_fetch_lead)
        if not lead:
            return "", {}

        collected: List[str] = []

        for key in ["conversation_text", "call_transcript", "email_thread", "meeting_notes", "chat_summary", "notes"]:
            value = lead.get(key)
            if isinstance(value, str) and value.strip():
                collected.append(value.strip())

        interactions = lead.get("interactions")
        if isinstance(interactions, list):
            for item in interactions:
                if isinstance(item, str) and item.strip():
                    collected.append(item.strip())
                elif isinstance(item, dict):
                    text = str(item.get("text") or item.get("content") or item.get("message") or "").strip()
                    actor = str(item.get("speaker") or item.get("role") or item.get("sender") or "interaction").strip()
                    if text:
                        collected.append(f"{actor}: {text}")

        hydration_meta = {
            "hydrated_from_lead": bool(collected),
            "hydrated_lead_id": lead_id,
        }

        return "\n".join(collected).strip(), hydration_meta

    async def _analyze_with_ai(self, conversation_text: str, source_type: str, messages: List[Any]) -> Dict[str, Any]:
        try:
            llm_result = await self._call_llm(conversation_text, source_type)
            return self._sanitize_analysis(llm_result, messages, conversation_text)
        except Exception as error:
            logger.warning(f"[Conversation Intelligence] LLM fallback triggered: {error}")
            heuristic = self._heuristic_analysis(conversation_text, messages)
            return self._sanitize_analysis(heuristic, messages, conversation_text)

    async def _call_llm(self, conversation_text: str, source_type: str) -> Dict[str, Any]:
        provider = str(os.getenv("CONV_INTELLIGENCE_PROVIDER", os.getenv("LLM_PROVIDER", "openai"))).lower()
        prompt = self._build_prompt(conversation_text, source_type)

        if provider == "gemini":
            return await self._call_gemini(prompt)

        return await self._call_openai(prompt)

    async def _call_openai(self, prompt: str) -> Dict[str, Any]:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is not configured")

        model_name = os.getenv("CONV_OPENAI_MODEL", os.getenv("OPENAI_LLM_MODEL", "gpt-4o-mini"))

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
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
                        {"role": "system", "content": "Return strict JSON only."},
                        {"role": "user", "content": prompt},
                    ],
                },
            )

        if response.status_code >= 400:
            raise ValueError(f"OpenAI analysis failed: {response.text}")

        payload = response.json()
        content = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise ValueError("OpenAI returned empty content")

        try:
            return json.loads(content)
        except json.JSONDecodeError as error:
            raise ValueError(f"OpenAI returned invalid JSON: {error}")

    async def _call_gemini(self, prompt: str) -> Dict[str, Any]:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY/GOOGLE_API_KEY is not configured")

        model_name = os.getenv("CONV_GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-1.5-flash"))
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                endpoint,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0,
                        "responseMimeType": "application/json",
                    },
                },
            )

        if response.status_code >= 400:
            raise ValueError(f"Gemini analysis failed: {response.text}")

        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini returned no candidates")

        parts = candidates[0].get("content", {}).get("parts", [])
        text_output = ""
        for part in parts:
            if isinstance(part, dict) and part.get("text"):
                text_output += str(part["text"])

        if not text_output.strip():
            raise ValueError("Gemini returned empty content")

        try:
            return json.loads(text_output)
        except json.JSONDecodeError as error:
            raise ValueError(f"Gemini returned invalid JSON: {error}")

    def _build_prompt(self, conversation_text: str, source_type: str) -> str:
        return f'''You are an enterprise CRM Conversation Intelligence Engine.

Analyze the provided conversation and return strict JSON only.

Source type: {source_type}

Return EXACTLY this schema:
{{
  "sentiment": "positive | neutral | negative",
  "client_intent": "interested | neutral | objection | competitor_evaluation | buying_signal",
  "objections": ["string"],
  "competitor_mentions": ["string"],
  "key_insights": ["string"]
}}

Rules:
- Return only valid JSON.
- Do not use markdown.
- No additional keys.
- Use lowercase enum values exactly as shown.
- If unknown, use neutral sentiment and neutral intent.
- Keep arrays empty when no evidence exists.

Conversation:
"""
{conversation_text}
"""
'''

    def _sanitize_analysis(self, raw: Dict[str, Any], messages: List[Any], conversation_text: str) -> Dict[str, Any]:
        sentiment = str(raw.get("sentiment") or "neutral").strip().lower()
        if sentiment not in ALLOWED_SENTIMENTS:
            sentiment = "neutral"

        client_intent = str(raw.get("client_intent") or "neutral").strip().lower()
        if client_intent not in ALLOWED_INTENTS:
            client_intent = "neutral"

        objections = self._sanitize_string_list(raw.get("objections"))
        competitor_mentions = self._sanitize_string_list(raw.get("competitor_mentions"))
        key_insights = self._sanitize_string_list(raw.get("key_insights"), max_items=8)

        if not key_insights:
            key_insights = self._heuristic_key_insights(conversation_text)

        # Enrich with deterministic detection so noisy LLM output does not drop critical signals.
        deterministic_competitors = self._extract_competitor_mentions(conversation_text)
        if deterministic_competitors:
            competitor_mentions = self._dedupe_preserve_order(competitor_mentions + deterministic_competitors)

        deterministic_objections = self._extract_objections(conversation_text)
        if deterministic_objections:
            objections = self._dedupe_preserve_order(objections + deterministic_objections)

        return {
            "sentiment": sentiment,
            "client_intent": client_intent,
            "objections": objections,
            "competitor_mentions": competitor_mentions,
            "key_insights": key_insights,
            "message_metrics": self._derive_message_metrics(messages, conversation_text),
        }

    def _heuristic_analysis(self, conversation_text: str, messages: List[Any]) -> Dict[str, Any]:
        lower_text = conversation_text.lower()

        positive_markers = ["great", "good", "excellent", "love", "happy", "works", "interested", "proceed"]
        negative_markers = ["issue", "problem", "concern", "expensive", "delay", "not happy", "bad", "difficult", "stuck"]

        positive_score = sum(lower_text.count(marker) for marker in positive_markers)
        negative_score = sum(lower_text.count(marker) for marker in negative_markers)

        if negative_score > positive_score + 1:
            sentiment = "negative"
        elif positive_score > negative_score + 1:
            sentiment = "positive"
        else:
            sentiment = "neutral"

        competitor_mentions = self._extract_competitor_mentions(conversation_text)
        objections = self._extract_objections(conversation_text)

        buying_signal_markers = ["send contract", "finalize", "ready to buy", "next steps", "sign", "purchase", "go ahead"]
        interest_markers = ["demo", "interested", "pricing", "proposal", "timeline", "trial"]

        if any(marker in lower_text for marker in buying_signal_markers):
            client_intent = "buying_signal"
        elif competitor_mentions:
            client_intent = "competitor_evaluation"
        elif objections:
            client_intent = "objection"
        elif any(marker in lower_text for marker in interest_markers):
            client_intent = "interested"
        else:
            client_intent = "neutral"

        return {
            "sentiment": sentiment,
            "client_intent": client_intent,
            "objections": objections,
            "competitor_mentions": competitor_mentions,
            "key_insights": self._heuristic_key_insights(conversation_text),
            "message_metrics": self._derive_message_metrics(messages, conversation_text),
        }

    def _derive_message_metrics(self, messages: List[Any], conversation_text: str) -> Dict[str, int]:
        client_count = 0
        rep_count = 0
        total_count = 0
        rep_word_count = 0
        rep_questions = 0

        for message in messages:
            if not isinstance(message, dict):
                continue

            speaker = str(
                message.get("speaker")
                or message.get("role")
                or message.get("sender")
                or ""
            ).lower()
            text = str(
                message.get("text")
                or message.get("content")
                or message.get("message")
                or message.get("body")
                or ""
            ).strip()

            if not text:
                continue

            total_count += 1
            words = len(text.split())

            if any(marker in speaker for marker in ["client", "customer", "lead", "prospect", "buyer", "user"]):
                client_count += 1
            elif any(marker in speaker for marker in ["rep", "sales", "agent", "advisor", "owner"]):
                rep_count += 1
                rep_word_count += words
                if "?" in text:
                    rep_questions += 1

        if total_count == 0:
            # Fallback estimation from raw text lines.
            lines = [line for line in re.split(r"[\n\r]+", conversation_text) if line.strip()]
            total_count = len(lines)
            for line in lines:
                normalized = line.lower()
                if normalized.startswith(("client:", "customer:", "lead:", "prospect:")):
                    client_count += 1
                elif normalized.startswith(("rep:", "sales:", "agent:", "advisor:")):
                    rep_count += 1
                    rep_word_count += len(line.split())
                    if "?" in line:
                        rep_questions += 1

        return {
            "client_message_count": client_count,
            "rep_message_count": rep_count,
            "total_turns": total_count,
            "rep_word_count": rep_word_count,
            "rep_questions": rep_questions,
        }

    def _compute_scores(self, analysis: Dict[str, Any], messages: List[Any], conversation_text: str) -> Dict[str, int]:
        sentiment = analysis.get("sentiment", "neutral")
        intent = analysis.get("client_intent", "neutral")
        objections = analysis.get("objections", [])
        competitor_mentions = analysis.get("competitor_mentions", [])

        intent_score = self.intent_base_scores.get(intent, 52)

        if sentiment == "positive":
            intent_score += self.scoring_config.positive_sentiment_bonus
        elif sentiment == "negative":
            intent_score -= self.scoring_config.negative_sentiment_penalty

        intent_score -= min(len(objections), 3) * self.scoring_config.objection_penalty_per_item
        intent_score -= min(len(competitor_mentions), 2) * self.scoring_config.competitor_penalty_per_item

        if intent == "buying_signal" and sentiment != "negative":
            intent_score += 5

        intent_score = int(self._clamp(intent_score, 0, 100))

        message_metrics = analysis.get("message_metrics") or self._derive_message_metrics(messages, conversation_text)
        engagement_score = self._compute_engagement_score(message_metrics)
        balance_score = self._compute_balance_score(message_metrics)
        quality_score = self._compute_quality_score(message_metrics)

        rep_score = (
            engagement_score * self.scoring_config.engagement_weight
            + balance_score * self.scoring_config.balance_weight
            + quality_score * self.scoring_config.quality_weight
        )

        return {
            "client_intent_score": int(self._clamp(round(intent_score), 0, 100)),
            "sales_rep_performance_score": int(self._clamp(round(rep_score), 0, 100)),
            "engagement_score": int(self._clamp(round(engagement_score), 0, 100)),
            "balance_score": int(self._clamp(round(balance_score), 0, 100)),
            "response_quality_score": int(self._clamp(round(quality_score), 0, 100)),
        }

    def _compute_engagement_score(self, message_metrics: Dict[str, int]) -> float:
        total_turns = int(message_metrics.get("total_turns", 0))
        if total_turns <= 0:
            return 20.0
        # 10 turns or more is considered excellent engagement.
        return self._clamp(total_turns * 10, 20, 100)

    def _compute_balance_score(self, message_metrics: Dict[str, int]) -> float:
        client_count = int(message_metrics.get("client_message_count", 0))
        rep_count = int(message_metrics.get("rep_message_count", 0))

        if client_count <= 0 or rep_count <= 0:
            return 50.0

        ratio = rep_count / max(client_count, 1)
        # Ideal speaking balance is close to 1:1.
        score = 100 - (abs(1 - ratio) * 70)
        return self._clamp(score, 20, 100)

    def _compute_quality_score(self, message_metrics: Dict[str, int]) -> float:
        rep_count = int(message_metrics.get("rep_message_count", 0))
        rep_word_count = int(message_metrics.get("rep_word_count", 0))
        rep_questions = int(message_metrics.get("rep_questions", 0))

        if rep_count <= 0:
            return 50.0

        average_words = rep_word_count / max(rep_count, 1)

        if average_words < 4:
            word_score = 45
        elif average_words < 8:
            word_score = 65
        elif average_words <= 35:
            word_score = 85
        else:
            word_score = 75

        question_ratio = rep_questions / max(rep_count, 1)
        question_score = self._clamp(question_ratio * 100, 35, 90)

        return (word_score * 0.7) + (question_score * 0.3)

    def _detect_risk(self, analysis: Dict[str, Any], scores: Dict[str, int]) -> Dict[str, Any]:
        sentiment = analysis.get("sentiment", "neutral")
        objections = analysis.get("objections", [])
        competitor_mentions = analysis.get("competitor_mentions", [])

        engagement_score = int(scores.get("engagement_score", 0))

        flags: List[str] = []
        severity = 0

        if competitor_mentions:
            flags.append("Competitor mentioned by client")
            severity += 2

        if sentiment == "negative" and objections:
            flags.append("Negative sentiment with objections")
            severity += 2

        if engagement_score < self.scoring_config.low_engagement_threshold:
            flags.append("Low engagement signal detected")
            severity += 1

        if severity >= 3:
            label = "Deal at Risk"
        elif severity >= 1:
            label = "Moderate Risk"
        else:
            label = "Healthy Deal"

        return {
            "label": label,
            "flags": flags,
            "risk_score": int(self._clamp(severity * 30, 0, 100)),
        }

    async def _store_record(self, output: Dict[str, Any], conversation_text: str) -> Optional[str]:
        if self.collection is None:
            return None

        document = {
            "schema_version": "1.0",
            "source_type": output.get("source_type"),
            "lead_id": output.get("lead_id"),
            "conversation_id": output.get("conversation_id"),
            "conversation_text": conversation_text,
            "analysis": output.get("analysis"),
            "scores": output.get("scores"),
            "risk": output.get("risk"),
            "insights": output.get("insights"),
            "metadata": output.get("metadata") or {},
            "analyzed_at": output.get("analyzed_at"),
        }

        def _insert() -> Any:
            return self.collection.insert_one(document)

        result = await asyncio.to_thread(_insert)
        return str(result.inserted_id)

    def _extract_competitor_mentions(self, text: str) -> List[str]:
        candidate_terms = [
            "competitor",
            "alternative",
            "other vendor",
            "salesforce",
            "hubspot",
            "zoho",
            "freshworks",
            "pipedrive",
            "microsoft",
            "oracle",
            "sap",
        ]
        lower = text.lower()
        matches = [term for term in candidate_terms if term in lower]
        return self._dedupe_preserve_order(matches)

    def _extract_objections(self, text: str) -> List[str]:
        patterns = [
            r"\btoo expensive\b",
            r"\bnot sure\b",
            r"\bneed approval\b",
            r"\bconcern\b",
            r"\bproblem\b",
            r"\bissue\b",
            r"\bdoesn['’]t fit\b",
            r"\bbudget\b",
            r"\bintegration\b",
            r"\bsecurity\b",
        ]
        lower = text.lower()
        findings = []
        for pattern in patterns:
            if re.search(pattern, lower):
                findings.append(re.sub(r"\\b", "", pattern).replace("\\", ""))
        return self._dedupe_preserve_order(findings)

    def _heuristic_key_insights(self, text: str) -> List[str]:
        if not text.strip():
            return []

        chunks = [
            segment.strip()
            for segment in re.split(r"(?<=[.!?])\s+|\n+", text)
            if segment and segment.strip()
        ]

        insights: List[str] = []
        for chunk in chunks:
            if len(chunk) < 20:
                continue
            insights.append(chunk[:220])
            if len(insights) >= 4:
                break

        return insights

    def _sanitize_string_list(self, value: Any, max_items: int = 10) -> List[str]:
        if not isinstance(value, list):
            return []

        sanitized: List[str] = []
        for item in value:
            item_text = str(item).strip()
            if item_text:
                sanitized.append(item_text[:220])
            if len(sanitized) >= max_items:
                break

        return self._dedupe_preserve_order(sanitized)

    def _dedupe_preserve_order(self, items: List[str]) -> List[str]:
        seen = set()
        deduped = []
        for item in items:
            key = item.lower().strip()
            if not key or key in seen:
                continue
            seen.add(key)
            deduped.append(item)
        return deduped

    def _clamp(self, value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))


_conversation_intelligence_service: Optional[ConversationIntelligenceService] = None


def get_conversation_intelligence_service() -> ConversationIntelligenceService:
    global _conversation_intelligence_service
    if _conversation_intelligence_service is None:
        _conversation_intelligence_service = ConversationIntelligenceService()
    return _conversation_intelligence_service
