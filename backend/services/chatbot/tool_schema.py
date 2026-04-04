"""Tool schema definitions for the CRM chatbot service."""

from __future__ import annotations

from typing import Any, Dict, List

TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "name": "get_leads",
        "description": "Fetch leads with optional probability/date filters and direct lookup fields.",
        "parameters": {
            "type": "object",
            "properties": {
                "probability": {"type": "string", "enum": ["high", "medium", "low"]},
                "date_range": {"type": "string", "enum": ["last_7_days", "last_30_days"]},
                "name": {"type": "string", "minLength": 1, "maxLength": 200},
                "email": {"type": "string", "minLength": 3, "maxLength": 254},
                "unique_id": {"type": "string", "minLength": 1, "maxLength": 100},
                "role_position": {"type": "string", "minLength": 1, "maxLength": 200},
                "limit": {"type": "integer", "minimum": 1, "maximum": 50},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "add_lead",
        "description": "Create a lead, run ML temperature prediction, and store it.",
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "minLength": 1, "maxLength": 200},
                "email": {"type": "string", "minLength": 3, "maxLength": 254},
                "role_position": {"type": "string", "minLength": 1, "maxLength": 200},
                "phone": {"type": "string", "maxLength": 32},
                "highest_education": {"type": "string", "maxLength": 120},
                "years_of_experience": {"type": "integer", "minimum": 0, "maximum": 60},
                "skills": {"type": "string", "maxLength": 1000},
                "location": {"type": "string", "maxLength": 200},
                "linkedin_profile": {"type": "string", "maxLength": 300},
                "expected_salary": {"type": "integer", "minimum": 0, "maximum": 1000000000},
                "willing_to_relocate": {"type": "string", "maxLength": 20},
                "company_name": {"type": "string", "maxLength": 200},
                "company_website": {"type": "string", "maxLength": 300},
                "company_email": {"type": "string", "maxLength": 254},
            },
            "required": ["name", "email", "role_position"],
            "additionalProperties": False,
        },
    },
    {
        "name": "analyze_conversation",
        "description": "Generate structured AI insights from conversation text or file content.",
        "parameters": {
            "type": "object",
            "properties": {
                "source_type": {
                    "type": "string",
                    "enum": ["call_transcript", "whatsapp_chat", "meeting_notes"],
                },
                "conversation_text": {"type": "string", "maxLength": 20000},
                "file_name": {"type": "string", "maxLength": 255},
                "file_content_base64": {"type": "string", "maxLength": 3000000},
            },
            "required": ["source_type"],
            "additionalProperties": False,
        },
    },
    {
        "name": "enrich_company",
        "description": "Enrich company details from email/website using scraper and AI intelligence pipeline.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string", "minLength": 1, "maxLength": 200},
                "company_website": {"type": "string", "maxLength": 300},
                "company_email": {"type": "string", "maxLength": 254},
            },
            "required": ["company_name"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_stats",
        "description": "Get high-level CRM and ML stats summary.",
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
    {
        "name": "general_assistant",
        "description": "Answer general questions about CRM features or broader informational queries.",
        "parameters": {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    },
]

TOOL_NAMES = {tool["name"] for tool in TOOL_DEFINITIONS}
TOOL_PARAMETERS_BY_NAME = {tool["name"]: tool["parameters"] for tool in TOOL_DEFINITIONS}

# Strict schema for Gemini response. We validate again server-side regardless of this schema.
GEMINI_TOOL_CALL_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "tool": {"type": "string", "enum": sorted(TOOL_NAMES)},
        "arguments": {
            "type": "object",
            "properties": {
                "probability": {"type": "string"},
                "date_range": {"type": "string"},
                "limit": {"type": "integer"},
                "name": {"type": "string"},
                "email": {"type": "string"},
                "role_position": {"type": "string"},
                "phone": {"type": "string"},
                "highest_education": {"type": "string"},
                "years_of_experience": {"type": "integer"},
                "skills": {"type": "string"},
                "location": {"type": "string"},
                "linkedin_profile": {"type": "string"},
                "expected_salary": {"type": "integer"},
                "willing_to_relocate": {"type": "string"},
                "company_name": {"type": "string"},
                "company_website": {"type": "string"},
                "company_email": {"type": "string"},
                "source_type": {"type": "string"},
                "conversation_text": {"type": "string"},
                "file_name": {"type": "string"},
                "file_content_base64": {"type": "string"},
            },
            "additionalProperties": True,
        },
    },
    "required": ["tool", "arguments"],
    "additionalProperties": False,
}
