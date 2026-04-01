"""Tool implementation for creating a lead with ML prediction."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Dict



def _get_ml_service():
    service_dir = Path(__file__).resolve().parents[2]
    service_file = service_dir / "ml_prediction_service.py"
    spec = importlib.util.spec_from_file_location("chatbot_ml_prediction_service", str(service_file))
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to load ML service from {service_file}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    get_lead_scoring_service = getattr(module, "get_lead_scoring_service")

    return get_lead_scoring_service()



def execute(arguments: Dict[str, Any]) -> Dict[str, Any]:
    ml_service = _get_ml_service()

    payload = {
        "name": arguments["name"],
        "email": arguments["email"],
        "role_position": arguments["role_position"],
        "phone": arguments.get("phone"),
        "highest_education": arguments.get("highest_education"),
        "years_of_experience": arguments.get("years_of_experience", 0),
        "skills": arguments.get("skills"),
        "location": arguments.get("location"),
        "linkedin_profile": arguments.get("linkedin_profile"),
        "expected_salary": arguments.get("expected_salary", 0),
        "willing_to_relocate": arguments.get("willing_to_relocate", "No"),
        "company_name": arguments.get("company_name"),
        "company_website": arguments.get("company_website"),
        "company_email": arguments.get("company_email"),
    }

    result = ml_service.process_lead_with_ml(payload)
    prediction = result.get("ml_prediction", {})

    if isinstance(prediction, dict) and prediction.get("error"):
        raise RuntimeError(f"ML prediction failed: {prediction['error']}")

    return {
        "unique_id": result.get("unique_id"),
        "lead": {
            "name": result.get("name") or payload["name"],
            "email": result.get("email") or payload["email"],
            "role_position": result.get("role_position") or payload["role_position"],
        },
        "prediction": prediction,
    }
