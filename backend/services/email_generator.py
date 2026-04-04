"""
Smart Email Generator Service
------------------------------
Generates contextual follow-up emails for CRM leads using an LLM.

HOW IT WORKS:
1. Frontend calls POST /email/generate-followup with a lead's unique_id
2. This service fetches the lead details from the ML service (same as /lead/{id})
3. Builds a prompt using lead status, past communication context, and deal stage
4. Calls the LLM API (plug in your API key when provided)
5. Returns the generated email subject + body

USAGE (add this file to your project, then register the router in main.py):
    from email_generator import router as email_router
    app.include_router(email_router)
"""

import os
import logging
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from dotenv import dotenv_values, load_dotenv

router = APIRouter(prefix="/email", tags=["Email Generator"])

# ─── Request / Response Models ────────────────────────────────────────────────

class EmailGenerateRequest(BaseModel):
    unique_id: str                          # Lead's unique_id from MongoDB
    deal_stage: Optional[str] = "Prospect" # e.g. Prospect, Negotiation, Closed
    past_communication: Optional[str] = "" # Any notes / last interaction summary

class EmailGenerateResponse(BaseModel):
    success: bool
    lead_name: str
    lead_email: str
    subject: str
    body: str
    lead_temperature: str                   # Hot / Warm / Cold


# ─── LLM Configuration (plug in key when provided) ───────────────────────────

def _load_env_files() -> None:
    """Load .env from common locations, including project root."""
    service_dir = Path(__file__).resolve().parent
    project_root = service_dir.parents[1]
    env_candidates = [
        project_root / ".env",
        service_dir.parent / ".env",
        service_dir / ".env",
        Path.cwd() / ".env",
    ]

    for env_path in env_candidates:
        if env_path.exists():
            # Override so latest .env values are respected even if stale env vars exist.
            load_dotenv(env_path, override=True)


def _resolve_provider_and_key() -> tuple[str, str]:
    """Resolve provider and key with support for provider-specific env vars."""
    service_dir = Path(__file__).resolve().parent
    project_root = service_dir.parents[1]
    file_values = dotenv_values(project_root / ".env")

    def _env_or_file(name: str) -> str:
        env_val = os.getenv(name, "")
        if env_val and env_val.strip():
            return env_val.strip()
        return str(file_values.get(name) or "").strip()

    provider = _env_or_file("LLM_PROVIDER").lower()

    generic_key = _env_or_file("LLM_API_KEY")
    openai_key = _env_or_file("OPENAI_API_KEY")
    groq_key = _env_or_file("GROQ_API_KEY")
    anthropic_key = _env_or_file("ANTHROPIC_API_KEY")
    gemini_key = _env_or_file("GEMINI_API_KEY") or _env_or_file("GOOGLE_API_KEY")

    if not provider:
        if gemini_key:
            provider = "gemini"
        elif openai_key or generic_key:
            provider = "openai"
        elif groq_key:
            provider = "groq"
        elif anthropic_key:
            provider = "anthropic"
        else:
            provider = "openai"

    provider_keys = {
        "openai": openai_key,
        "groq": groq_key,
        "anthropic": anthropic_key,
        "gemini": gemini_key,
    }

    if provider and not generic_key and not provider_keys.get(provider):
        for fallback_provider in ["gemini", "openai", "groq", "anthropic"]:
            if provider_keys.get(fallback_provider):
                provider = fallback_provider
                break

    selected_key = generic_key or provider_keys.get(provider, "")
    return provider, selected_key


def _refresh_llm_settings() -> None:
    """Refresh provider/key/model from environment before each generation call."""
    global LLM_PROVIDER, LLM_API_KEY, LLM_MODEL
    _load_env_files()
    LLM_PROVIDER, LLM_API_KEY = _resolve_provider_and_key()
    if LLM_PROVIDER == "gemini":
        LLM_MODEL = os.getenv("GEMINI_MODEL", os.getenv("LLM_MODEL", LLM_DEFAULT_MODEL["gemini"]))
    else:
        LLM_MODEL = os.getenv("LLM_MODEL", LLM_DEFAULT_MODEL.get(LLM_PROVIDER, "gpt-4o-mini"))


def _get_gemini_model_candidates() -> list[str]:
    """Return prioritized Gemini models, preferring high-quota flash-lite variants."""
    preferred = (os.getenv("GEMINI_MODEL", "") or "").strip()
    candidates = [
        preferred,
        "gemini-3.1-flash-lite-preview",
        "gemini-2.5-flash-lite",
        "gemini-3.1-flash-preview",
        "gemini-2.5-flash",
    ]

    # Preserve order while removing blanks/duplicates.
    deduped = []
    seen = set()
    for model_name in candidates:
        if not model_name or model_name in seen:
            continue
        seen.add(model_name)
        deduped.append(model_name)
    return deduped


_load_env_files()

# Supported providers: "openai" | "anthropic" | "groq" | "gemini"
# Provider auto-detection prefers Gemini when GEMINI_API_KEY/GOOGLE_API_KEY is present.
LLM_PROVIDER, LLM_API_KEY = _resolve_provider_and_key()
LLM_DEFAULT_MODEL = {
    "openai": "gpt-4o-mini",
    "groq": "llama3-8b-8192",
    "anthropic": "claude-3-haiku-20240307",
    "gemini": "gemini-3.1-flash-lite-preview",
}
if LLM_PROVIDER == "gemini":
    LLM_MODEL = os.getenv("GEMINI_MODEL", os.getenv("LLM_MODEL", LLM_DEFAULT_MODEL["gemini"]))
else:
    LLM_MODEL = os.getenv("LLM_MODEL", LLM_DEFAULT_MODEL.get(LLM_PROVIDER, "gpt-4o-mini"))


# ─── Internal: Fetch lead from existing ML service ───────────────────────────

def _fetch_lead_from_service(unique_id: str) -> dict:
    """
    Calls the existing /lead/{unique_id} endpoint on the same FastAPI server
    to get full lead details with ML predictions.
    """
    try:
        # Import the ML service directly to avoid HTTP overhead (same process)
        from main import get_ml_service
        ml_service = get_ml_service()
        lead = ml_service.get_lead_with_prediction(unique_id)
        if not lead:
            raise HTTPException(status_code=404, detail=f"Lead '{unique_id}' not found")
        return lead
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[EmailGen] Failed to fetch lead {unique_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch lead details")


# ─── Internal: Build LLM Prompt ──────────────────────────────────────────────

def _build_prompt(lead: dict, deal_stage: str, past_communication: str) -> str:
    """
    Constructs the prompt sent to the LLM.
    Uses: Lead status (temperature), past communication, deal stage.
    """
    name       = lead.get("name", "the lead")
    role       = lead.get("role_position", "Professional")
    skills     = lead.get("skills", "N/A")
    location   = lead.get("location", "N/A")
    experience = lead.get("years_of_experience", 0)
    temperature = lead.get("ml_prediction", {}).get("predicted_temperature", "Warm")

    # Tone guidance based on lead temperature
    tone_map = {
        "Hot":  "urgent and enthusiastic — this lead is highly interested, push toward action",
        "Warm": "friendly and informative — this lead is considering, nurture their interest",
        "Cold": "polite and value-focused — this lead needs re-engagement, remind them of benefits",
    }
    tone = tone_map.get(temperature, "professional and helpful")

    prompt = f"""You are a professional B2B sales executive writing a follow-up email for a CRM lead.

LEAD DETAILS:
- Name: {name}
- Role/Position: {role}
- Skills: {skills}
- Location: {location}
- Years of Experience: {experience}
- Lead Temperature (AI Score): {temperature}
- Current Deal Stage: {deal_stage}

PAST COMMUNICATION SUMMARY:
{past_communication if past_communication else "No previous communication recorded."}

INSTRUCTIONS:
Write a short, personalized follow-up email. Tone should be: {tone}.
The email must:
1. Address the lead by their first name
2. Reference their role/deal stage naturally
3. Include a clear call-to-action (schedule a call, reply, etc.)
4. Be 3-5 short paragraphs max

Return ONLY in this exact format (no extra text):
SUBJECT: <subject line here>
BODY:
<email body here>
"""
    return prompt


# ─── Internal: Call the LLM ──────────────────────────────────────────────────

async def _call_llm(prompt: str) -> str:
    """
    Calls the configured LLM provider.
    Currently supports OpenAI-compatible APIs.
    Add more providers below when needed.
    """
    _refresh_llm_settings()

    if not LLM_API_KEY:
        # Return a placeholder so the feature works without a key (for testing)
        logging.warning("[EmailGen] No LLM API key configured (LLM_API_KEY/OPENAI_API_KEY/GEMINI_API_KEY/etc.)")
        return (
            "SUBJECT: Following up on our conversation\n"
            "BODY:\nHi [Lead Name],\n\n"
            "This is a placeholder email. Please set a valid LLM key in your environment "
            "variables to enable AI-generated emails.\n\n"
            "Best regards,\nYour CRM"
        )

    if LLM_PROVIDER == "openai":
        return await _call_openai(prompt)
    elif LLM_PROVIDER == "groq":
        return await _call_groq(prompt)
    elif LLM_PROVIDER == "anthropic":
        return await _call_anthropic(prompt)
    elif LLM_PROVIDER == "gemini":
        return await _call_gemini(prompt)
    else:
        raise HTTPException(status_code=500, detail=f"Unsupported LLM_PROVIDER: {LLM_PROVIDER}")


async def _call_openai(prompt: str) -> str:
    """OpenAI / OpenAI-compatible API (also works for Groq with base_url change)."""
    base_url = "https://api.openai.com/v1/chat/completions"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            base_url,
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 600,
            }
        )
    if response.status_code != 200:
        logging.error(f"[EmailGen] OpenAI error: {response.text}")
        raise HTTPException(status_code=502, detail="LLM API call failed")

    return response.json()["choices"][0]["message"]["content"].strip()


async def _call_groq(prompt: str) -> str:
    """Groq API — just change base_url and model."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL or "llama3-8b-8192",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 600,
            }
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Groq API call failed")
    return response.json()["choices"][0]["message"]["content"].strip()


async def _call_anthropic(prompt: str) -> str:
    """Anthropic Claude API."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": LLM_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL or "claude-3-haiku-20240307",
                "max_tokens": 600,
                "messages": [{"role": "user", "content": prompt}],
            }
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="Anthropic API call failed")
    return response.json()["content"][0]["text"].strip()


async def _call_gemini(prompt: str) -> str:
    """Google Gemini API (REST)."""
    model_candidates = _get_gemini_model_candidates()
    last_error = ""

    async with httpx.AsyncClient(timeout=30) as client:
        for model_name in model_candidates:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
            response = await client.post(
                endpoint,
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": LLM_API_KEY,
                },
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 600,
                    },
                },
            )

            if response.status_code == 200:
                payload = response.json()
                candidates = payload.get("candidates", [])
                if not candidates:
                    last_error = f"Gemini returned no candidates for {model_name}"
                    continue

                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(part.get("text", "") for part in parts).strip()
                if not text:
                    last_error = f"Gemini returned empty content for {model_name}"
                    continue

                return text

            last_error = f"[{model_name}] {response.status_code}: {response.text}"
            # Retry on quota/availability/model-not-found with next fallback model.
            if response.status_code in {404, 429, 503}:
                continue
            logging.error(f"[EmailGen] Gemini error: {last_error}")
            raise HTTPException(status_code=502, detail="Gemini API call failed")

    logging.error(f"[EmailGen] Gemini error after fallbacks: {last_error}")
    raise HTTPException(status_code=502, detail="Gemini API call failed")


# ─── Internal: Parse LLM Output ──────────────────────────────────────────────

def _parse_email_output(raw: str) -> tuple[str, str]:
    """
    Parses LLM output into (subject, body).
    Expected format:
        SUBJECT: <subject>
        BODY:
        <body text>
    """
    subject = "Follow-up"
    body = raw

    lines = raw.strip().splitlines()
    subject_line = next((l for l in lines if l.upper().startswith("SUBJECT:")), None)
    if subject_line:
        subject = subject_line.split(":", 1)[1].strip()

    body_start = next((i for i, l in enumerate(lines) if l.upper().startswith("BODY:")), None)
    if body_start is not None:
        body = "\n".join(lines[body_start + 1:]).strip()

    return subject, body


# ─── Main Endpoint ────────────────────────────────────────────────────────────

@router.post("/generate-followup", response_model=EmailGenerateResponse,
             summary="Generate Follow-up Email for a Lead")
async def generate_followup_email(request: EmailGenerateRequest):
    """
    Generates a contextual follow-up email for the given lead.

    Steps:
    1. Fetch lead details from the ML service using unique_id
    2. Build a prompt using lead status (temperature), deal stage, past communication
    3. Call the LLM to generate the email
    4. Return the subject and body

    Set LLM_API_KEY environment variable to enable real generation.
    When no key is set, returns a placeholder email (useful for testing).
    """
    # Step 1: Get lead
    lead = _fetch_lead_from_service(request.unique_id)

    # Step 2: Build prompt
    prompt = _build_prompt(lead, request.deal_stage, request.past_communication)

    # Step 3: Call LLM
    raw_output = await _call_llm(prompt)

    # Step 4: Parse output
    subject, body = _parse_email_output(raw_output)

    temperature = lead.get("ml_prediction", {}).get("predicted_temperature", "Unknown")

    return EmailGenerateResponse(
        success=True,
        lead_name=str(lead.get("name") or ""),
        lead_email=str(lead.get("email") or ""),
        subject=str(subject or "Follow-up"),
        body=str(body or ""),
        lead_temperature=str(temperature or "Unknown"),
    )