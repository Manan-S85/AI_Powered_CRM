"""Tool implementation for fetching CRM summary stats."""

from __future__ import annotations

import importlib.util
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()



def _get_ml_service():
    service_dir = Path(__file__).resolve().parents[2]
    service_file = service_dir / "ml_prediction_service.py"
    spec = importlib.util.spec_from_file_location("chatbot_ml_prediction_service_for_stats", str(service_file))
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load ML service from {service_file}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    get_lead_scoring_service = getattr(module, "get_lead_scoring_service")

    return get_lead_scoring_service()



def _get_ai_insights_count() -> int:
    mongo_uri = os.getenv("MONGODB_URI", "").strip()
    db_name = os.getenv("DB_NAME", "ai_crm_db").strip() or "ai_crm_db"

    if not mongo_uri:
        return 0

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=7000)
    try:
        return int(client[db_name]["ai_insights"].count_documents({}))
    finally:
        client.close()



def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
    _ = arguments
    ml_service = _get_ml_service()
    ml_stats = ml_service.get_prediction_stats()

    ai_insights_count = _get_ai_insights_count()

    return {
        "ml_stats": ml_stats,
        "ai_insights_count": ai_insights_count,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }
