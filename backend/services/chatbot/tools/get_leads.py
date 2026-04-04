"""Tool implementation for querying CRM leads with strict filters."""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

_MAX_LIMIT = 50



def _serialize_lead(document: Dict[str, Any]) -> Dict[str, Any]:
    output: Dict[str, Any] = {}
    for key, value in document.items():
        if isinstance(value, ObjectId):
            output[key] = str(value)
        elif isinstance(value, datetime):
            output[key] = value.isoformat()
        else:
            output[key] = value
    return output



def _build_probability_filter(probability: str) -> Dict[str, Any]:
    if probability == "high":
        return {"ml_prediction.confidence": {"$gte": 0.8}}
    if probability == "medium":
        return {"ml_prediction.confidence": {"$gte": 0.5, "$lt": 0.8}}
    return {"ml_prediction.confidence": {"$lt": 0.5}}



def _build_date_filter(date_range: str) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    days = 7 if date_range == "last_7_days" else 30
    cutoff = now - timedelta(days=days)

    return {
        "$or": [
            {"processed_at": {"$gte": cutoff}},
            {"created_at": {"$gte": cutoff}},
            {"processed_at": {"$gte": cutoff.isoformat()}},
            {"created_at": {"$gte": cutoff.isoformat()}},
        ]
    }



def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
    mongo_uri = os.getenv("MONGODB_URI", "").strip()
    db_name = os.getenv("DB_NAME", "ai_crm_db").strip() or "ai_crm_db"

    if not mongo_uri:
        raise RuntimeError("MONGODB_URI is not configured")

    probability = arguments.get("probability")
    date_range = arguments.get("date_range")
    name = str(arguments.get("name") or "").strip()
    email = str(arguments.get("email") or "").strip()
    unique_id = str(arguments.get("unique_id") or "").strip()
    role_position = str(arguments.get("role_position") or "").strip()
    limit = min(int(arguments.get("limit", 20)), _MAX_LIMIT)

    query: Dict[str, Any] = {}
    if probability:
        query.update(_build_probability_filter(probability))
    if date_range:
        query = {"$and": [query, _build_date_filter(date_range)]} if query else _build_date_filter(date_range)

    if unique_id:
        query["unique_id"] = unique_id

    if email:
        query["email"] = {"$regex": f"^{re.escape(email)}$", "$options": "i"}

    if name:
        query["name"] = {"$regex": re.escape(name), "$options": "i"}

    if role_position:
        query["role_position"] = {"$regex": re.escape(role_position), "$options": "i"}

    projection = {
        "name": 1,
        "email": 1,
        "phone": 1,
        "role_position": 1,
        "location": 1,
        "processed_at": 1,
        "created_at": 1,
        "ml_prediction": 1,
        "unique_id": 1,
    }

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=7000)
    try:
        collection = client[db_name]["leads"]
        cursor = collection.find(query, projection).sort("_id", -1).limit(limit)
        leads = [_serialize_lead(doc) for doc in cursor]
    finally:
        client.close()

    return {
        "count": len(leads),
        "filters": {
            "probability": probability,
            "date_range": date_range,
            "name": name or None,
            "email": email or None,
            "unique_id": unique_id or None,
            "role_position": role_position or None,
            "limit": limit,
        },
        "leads": leads,
    }
