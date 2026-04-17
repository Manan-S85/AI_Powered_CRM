"""
FastAPI service for ML predictions and lead management.
This provides REST API endpoints for the frontend to access ML predictions.
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, ValidationError, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging
import os
import sys
from email_generator import router as email_router
from followup_service import router as followup_router
from client_ltv import router as clv_router
from sales_forecasting import generate_sales_forecast_report
import importlib.util
from pathlib import Path

# DO NOT import services at module level - causes hangs!
# from ml_prediction_service import lead_scoring_service
# from auth_service import auth_service

# Initialize FastAPI app
app = FastAPI(
    title="AI-Powered CRM - ML Prediction API",
    description="REST API for ML-based lead scoring and temperature prediction",
    version="2.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(email_router)
app.include_router(followup_router)
app.include_router(clv_router)

# Pydantic models for request/response
class UserSignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "admin"

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class LeadInput(BaseModel):
    # Core identification
    name: str
    email: EmailStr
    phone: Optional[str] = None
    
    # Professional details - matching Google Sheets columns
    highest_education: Optional[str] = None
    role_position: str
    years_of_experience: Optional[int] = 0
    skills: Optional[str] = None
    location: Optional[str] = None
    linkedin_profile: Optional[str] = None
    expected_salary: Optional[int] = 0
    willing_to_relocate: Optional[str] = "No"

    # Company details for enrichment workflow
    company_name: Optional[str] = None
    company_website: Optional[str] = None
    company_email: Optional[str] = None
    
    # Legacy fields (optional for backward compatibility)
    availability: Optional[str] = None
    interview_status: Optional[str] = None
    resume_upload: Optional[str] = None


class ConversionLeadScoringInput(BaseModel):
    industry: str = Field(..., min_length=1)
    budget: float = Field(..., ge=0)
    response_speed: float = Field(..., ge=0)
    meeting_count: float = Field(..., ge=0)
    email_open_rate: float = Field(..., ge=0)
    website_visits: float = Field(..., ge=0)


class SearchResultInput(BaseModel):
    title: str = ""
    snippet: str = ""
    link: Optional[str] = None


class LeadGenerationQualifyRequest(BaseModel):
    query: Optional[str] = None
    search_results: List[SearchResultInput] = Field(default_factory=list)
    max_results: int = Field(10, ge=1, le=20)
    persist: bool = True

class MLPrediction(BaseModel):
    predicted_temperature: str
    confidence: float
    probabilities: Dict[str, float]
    model_version: str
    prediction_timestamp: str

class LeadResponse(BaseModel):
    unique_id: str
    name: str
    email: str
    role_position: str
    ml_prediction: MLPrediction
    processed_at: datetime

class PredictionStats(BaseModel):
    total_leads: int
    total_predictions: int
    coverage_percentage: float
    temperature_distribution: List[Dict[str, Any]]
    last_updated: str


class AIInsightsGenerateResponse(BaseModel):
    success: bool
    insights: Dict[str, Any]
    record_id: Optional[str] = None
    stored: bool
    conversation_intelligence_stored: bool = False
    conversation_intelligence_record_id: Optional[str] = None


class CompanyEnrichmentRequest(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    company_email: Optional[EmailStr] = None
    company_location: Optional[str] = None


class CompanyEnrichmentResponse(BaseModel):
    success: bool
    company: str
    domain: Optional[str]
    intelligence: Dict[str, Any]


class ChatbotChatRequest(BaseModel):
    user_input: str
    user_context: Optional[Dict[str, Any]] = None


class ConversationMessage(BaseModel):
    speaker: Optional[str] = None
    role: Optional[str] = None
    sender: Optional[str] = None
    text: Optional[str] = None
    content: Optional[str] = None
    message: Optional[str] = None
    body: Optional[str] = None


class ConversationIntelligenceRequest(BaseModel):
    source_type: str = "chat_message"
    lead_id: Optional[str] = None
    conversation_id: Optional[str] = None
    conversation_text: Optional[str] = None
    messages: List[ConversationMessage] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None
    persist: bool = True

_cached_auth_service = None
_lead_enrichment_modules = None
_conversation_intelligence_service = None
_conversion_lead_scoring_modules = None

# API Routes
@app.get("/", summary="Health Check")
async def root():
    """Health check endpoint."""
    return {
        "message": "AI-Powered CRM ML Prediction API",
        "version": "2.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health", summary="System Health")
async def health_check():
    """Detailed health check with service status."""
    return {
        "status": "healthy",
        "service": "AI-Powered CRM ML Prediction API", 
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "api": "running",
            "ml_service": "lazy_loaded",
            "auth_service": "lazy_loaded"
        }
    }

# Lazy import functions - only load services when needed
def get_ml_service():
    """Lazy import of ML service to prevent startup hangs."""
    try:
        from ml_prediction_service import lead_scoring_service
        return lead_scoring_service
    except Exception as e:
        logging.error(f"Failed to import ML service: {e}")
        # Return mock service
        class MockService:
            def process_lead_with_ml(self, data):
                return {"error": f"ML service unavailable: {e}"}
            def get_all_leads_with_predictions(self, limit=50):
                return []
            def get_prediction_stats(self):
                return {"error": "ML service unavailable"}
            def get_leads_by_temperature(self, temp, limit=20):
                return []
        return MockService()

def get_auth_service():
    """Lazy import of auth service to prevent startup hangs."""
    global _cached_auth_service

    if _cached_auth_service is not None:
        return _cached_auth_service

    # Check if we should skip MongoDB entirely
    if os.getenv('SKIP_MONGODB', 'false').lower() == 'true':
        logging.info("[DEV] SKIP_MONGODB enabled - using in-memory auth")
        from auth_service_inmemory import dev_auth_service
        _cached_auth_service = dev_auth_service
        return _cached_auth_service

    try:
        # Try MongoDB auth service
        from auth_service import get_auth_service as get_db_auth_service
        auth = get_db_auth_service()

        # Check if MongoDB is actually connected
        if auth.users_collection is not None:
            logging.info("[OK] Using MongoDB auth service")
            _cached_auth_service = auth
            return _cached_auth_service

        logging.warning("[WARN] MongoDB not connected, using in-memory auth")
        from auth_service_inmemory import dev_auth_service
        _cached_auth_service = dev_auth_service
        return _cached_auth_service

    except Exception as e:
        # Fall back to in-memory auth for development
        logging.warning(f"[FALLBACK] MongoDB auth failed ({e}), using in-memory auth")
        from auth_service_inmemory import dev_auth_service
        _cached_auth_service = dev_auth_service
        return _cached_auth_service


def _load_module_from_path(module_name: str, file_path: Path):
    """Load a Python module from an explicit file path."""
    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to build import spec for {file_path}")

    module = importlib.util.module_from_spec(spec)
    # Register before execution so decorators relying on sys.modules work correctly.
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def get_lead_enrichment_modules() -> Dict[str, Any]:
    """Load moved lead enrichment modules from folder with spaces in its name."""
    global _lead_enrichment_modules

    if _lead_enrichment_modules is not None:
        return _lead_enrichment_modules

    service_dir = Path(__file__).resolve().parent
    enrichment_dir = service_dir / "lead data enrichment"

    if not enrichment_dir.exists():
        raise ImportError(f"Lead enrichment directory not found at {enrichment_dir}")

    ai_processor = _load_module_from_path("lead_enrichment_ai_processor", enrichment_dir / "ai_processor.py")
    domain_extractor = _load_module_from_path("lead_enrichment_domain_extractor", enrichment_dir / "domain_extractor.py")
    website_scraper = _load_module_from_path("lead_enrichment_website_scraper", enrichment_dir / "website_scraper.py")

    _lead_enrichment_modules = {
        "generate_company_intelligence": getattr(ai_processor, "generate_company_intelligence"),
        "extract_domain": getattr(domain_extractor, "extract_domain"),
        "scrape_website": getattr(website_scraper, "scrape_website"),
    }
    return _lead_enrichment_modules


def get_conversion_lead_scoring_modules() -> Dict[str, Any]:
    """Load conversion lead scoring module from folder with spaces in path."""
    global _conversion_lead_scoring_modules

    if _conversion_lead_scoring_modules is not None:
        return _conversion_lead_scoring_modules

    service_dir = Path(__file__).resolve().parent
    scoring_module_path = service_dir / "Lead scoring engine" / "lead_scoring_service" / "lead_scoring_service.py"

    if not scoring_module_path.exists():
        raise ImportError(f"Conversion lead scoring module not found at {scoring_module_path}")

    module_dir = scoring_module_path.parent
    module_dir_str = str(module_dir)
    if module_dir_str not in sys.path:
        sys.path.insert(0, module_dir_str)

    model_loader_path = module_dir / "model_loader.py"
    if model_loader_path.exists() and "model_loader" not in sys.modules:
        _load_module_from_path("model_loader", model_loader_path)

    module = _load_module_from_path("conversion_lead_scoring_service_module", scoring_module_path)

    _conversion_lead_scoring_modules = {
        "predict_conversion_probability_details": getattr(module, "predict_conversion_probability_details"),
        "train_from_historical_data": getattr(module, "train_from_historical_data"),
        "qualify_search_results": getattr(module, "qualify_search_results"),
        "get_conversion_model_info": getattr(module, "get_conversion_model_info"),
    }
    return _conversion_lead_scoring_modules


def get_generated_leads_collection():
    """Resolve MongoDB collection used to persist lead generation results."""
    ml_service = get_ml_service()
    base_collection = getattr(ml_service, "collection", None)
    if base_collection is None:
        return None
    return base_collection.database["generated_leads"]


def _serialize_mongo_doc(document: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(document or {})
    if "_id" in payload:
        payload["_id"] = str(payload["_id"])
    return payload


def get_ai_insights_service():
    """Lazy import AI insights service to avoid startup issues."""
    try:
        # Prefer direct import when file exists in services root.
        from ai_insights_service import get_ai_insights_service as resolver
        return resolver()
    except Exception as e:
        logging.warning(f"Primary AI insights import failed, attempting fallback path load: {e}")

    service_dir = Path(__file__).resolve().parent
    fallback_path = service_dir / "smart lead summary" / "ai_insights_service.py"

    if not fallback_path.exists():
        raise ImportError(f"AI insights service file not found at {fallback_path}")

    module = _load_module_from_path("ai_insights_service_fallback", fallback_path)
    resolver = getattr(module, "get_ai_insights_service", None)

    if resolver is None:
        raise ImportError("Fallback AI insights module does not expose get_ai_insights_service")

    return resolver()


def get_conversation_intelligence_service():
    """Lazy import Conversation Intelligence service from folder with spaces."""
    global _conversation_intelligence_service

    if _conversation_intelligence_service is not None:
        return _conversation_intelligence_service

    service_dir = Path(__file__).resolve().parent
    service_path = service_dir / "conversation intelligence engine" / "conversation_intelligence_service.py"

    if not service_path.exists():
        raise ImportError(f"Conversation intelligence service file not found at {service_path}")

    module = _load_module_from_path("conversation_intelligence_service_module", service_path)
    resolver = getattr(module, "get_conversation_intelligence_service", None)

    if resolver is None:
        raise ImportError("Conversation intelligence module does not expose get_conversation_intelligence_service")

    _conversation_intelligence_service = resolver()
    return _conversation_intelligence_service

@app.post("/predict", response_model=Dict[str, Any], summary="Predict Lead Temperature")
async def predict_lead_temperature(payload: Dict[str, Any]):
    """
    Predict the temperature (Hot/Warm/Cold) for a new lead.
    """
    try:
        # Normalize empty strings to None for optional fields.
        normalized_payload = {
            key: (value.strip() if isinstance(value, str) else value)
            for key, value in (payload or {}).items()
        }

        for optional_field in [
            "phone",
            "highest_education",
            "skills",
            "location",
            "linkedin_profile",
            "company_name",
            "company_website",
            "company_email",
            "availability",
            "interview_status",
            "resume_upload",
        ]:
            if normalized_payload.get(optional_field) == "":
                normalized_payload[optional_field] = None

        if normalized_payload.get("years_of_experience") in ["", None]:
            normalized_payload["years_of_experience"] = 0
        if normalized_payload.get("expected_salary") in ["", None]:
            normalized_payload["expected_salary"] = 0

        try:
            lead = LeadInput.model_validate(normalized_payload)
        except ValidationError as validation_error:
            raise HTTPException(status_code=400, detail=validation_error.errors())

        lead_data = lead.model_dump()
        
        # Process with ML (lazy loaded)
        ml_service = get_ml_service()
        result = ml_service.process_lead_with_ml(lead_data)
        
        if 'error' in result.get('ml_prediction', {}):
            raise HTTPException(
                status_code=500, 
                detail=f"ML prediction failed: {result['ml_prediction']['error']}"
            )
        
        return {
            "success": True,
            "unique_id": result['unique_id'],
            "prediction": result['ml_prediction'],
            "message": "Lead temperature predicted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in predict endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lead-scoring/conversion/predict", response_model=Dict[str, Any], summary="Predict Lead Conversion Probability")
async def predict_lead_conversion_probability(payload: ConversionLeadScoringInput):
    """
    Predict conversion probability (%) using dynamic ML scoring.

    Inputs: industry, budget, response_speed, meeting_count, email_open_rate, website_visits
    Output: conversion probability percentage
    """
    try:
        modules = get_conversion_lead_scoring_modules()
        predictor = modules["predict_conversion_probability_details"]

        result = predictor(payload.model_dump())
        return {
            "success": True,
            "result": result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error in conversion predict endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lead-scoring/conversion/model-info", response_model=Dict[str, Any], summary="Get Conversion Lead Scoring Model Information")
async def get_conversion_lead_scoring_model_info():
    """Return model type, artifact paths, and available metrics for conversion scoring."""
    try:
        modules = get_conversion_lead_scoring_modules()
        model_info_getter = modules["get_conversion_model_info"]
        info = model_info_getter()
        return {
            "success": True,
            "model_info": info,
        }
    except Exception as e:
        logging.error(f"Error in conversion model info endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/lead-generation/qualify-search-results",
    response_model=List[Dict[str, Any]],
    summary="Qualify SerpApi Search Results Into Actionable Leads",
)
async def qualify_search_results_for_lead_generation(payload: LeadGenerationQualifyRequest):
    """
    Transform raw SerpApi search results into CRM-ready leads with service mapping and scoring.
    """
    try:
        modules = get_conversion_lead_scoring_modules()
        qualifier = modules["qualify_search_results"]
        query = str(payload.query or "").strip()

        search_results: List[Dict[str, Any]] = [result.model_dump() for result in payload.search_results]

        if query and not search_results:
            from serpapi_service import search_google_business_results

            search_results = search_google_business_results(query, num=payload.max_results)

        if not search_results:
            raise HTTPException(status_code=400, detail="Provide query or search_results")

        leads = qualifier(search_results, query_context=query)

        if payload.persist and query:
            collection = get_generated_leads_collection()
            if collection is not None and leads:
                generated_at = datetime.utcnow().isoformat()
                documents = []
                for index, lead in enumerate(leads):
                    normalized_lead = dict(lead)
                    normalized_lead["lead_category"] = str(normalized_lead.get("lead_category") or "COLD").upper()
                    documents.append(
                        {
                            "query": query,
                            "rank": index + 1,
                            "lead": normalized_lead,
                            "search_result": search_results[index] if index < len(search_results) else {},
                            "generated_at": generated_at,
                            "source": "serpapi-google",
                        }
                    )

                if documents:
                    collection.insert_many(documents)

        return leads
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error in lead generation qualify endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/lead-generation/search-query",
    response_model=Dict[str, Any],
    summary="Lead Generation From Natural Language Query",
)
async def run_lead_generation_from_query(payload: LeadGenerationQualifyRequest):
    """
    Accept natural language query, fetch SerpApi results, qualify leads,
    and persist results for lead dashboard analytics.
    """
    try:
        query = str(payload.query or "").strip()
        if not query:
            raise HTTPException(status_code=400, detail="query is required")

        from serpapi_service import search_google_business_results

        modules = get_conversion_lead_scoring_modules()
        qualifier = modules["qualify_search_results"]

        search_results = search_google_business_results(query, num=payload.max_results)
        leads = qualifier(search_results, query_context=query)

        persisted_count = 0
        if payload.persist:
            collection = get_generated_leads_collection()
            if collection is None:
                raise HTTPException(status_code=503, detail="MongoDB unavailable for lead dashboard persistence")

            generated_at = datetime.utcnow().isoformat()
            documents = []
            for index, lead in enumerate(leads):
                normalized_lead = dict(lead)
                normalized_lead["lead_category"] = str(normalized_lead.get("lead_category") or "COLD").upper()
                documents.append(
                    {
                        "query": query,
                        "rank": index + 1,
                        "lead": normalized_lead,
                        "search_result": search_results[index] if index < len(search_results) else {},
                        "generated_at": generated_at,
                        "source": "serpapi-google",
                    }
                )

            if documents:
                inserted = collection.insert_many(documents)
                persisted_count = len(inserted.inserted_ids)

        return {
            "success": True,
            "query": query,
            "count": len(leads),
            "persisted_count": persisted_count,
            "leads": leads,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error in lead generation query endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get(
    "/lead-generation/dashboard",
    response_model=Dict[str, Any],
    summary="Lead Generation Dashboard Data",
)
async def get_lead_generation_dashboard(
    limit: int = Query(100, ge=1, le=500),
    category: Optional[str] = Query(None),
):
    """Return persisted lead-generation records and HOT/WARM/COLD counts."""
    try:
        collection = get_generated_leads_collection()
        if collection is None:
            raise HTTPException(status_code=503, detail="MongoDB unavailable for lead dashboard")

        normalized_category = str(category or "").strip().upper()
        query: Dict[str, Any] = {}
        if normalized_category:
            if normalized_category not in {"HOT", "WARM", "COLD"}:
                raise HTTPException(status_code=400, detail="category must be HOT, WARM, or COLD")
            query["lead.lead_category"] = normalized_category

        records = [_serialize_mongo_doc(doc) for doc in collection.find(query).sort("generated_at", -1).limit(limit)]

        def _is_noise_record(record: Dict[str, Any]) -> bool:
            lead = record.get("lead") if isinstance(record, dict) else {}
            business_name = str((lead or {}).get("business_name") or "").lower()
            return any(token in business_name for token in ["list of", "view list", "directory"])

        records = [record for record in records if not _is_noise_record(record)]

        distribution = {"HOT": 0, "WARM": 0, "COLD": 0}
        for row in collection.aggregate([{"$group": {"_id": "$lead.lead_category", "count": {"$sum": 1}}}]):
            label = str(row.get("_id") or "").upper()
            if label in distribution:
                distribution[label] = int(row.get("count") or 0)

        return {
            "success": True,
            "count": len(records),
            "classification_counts": distribution,
            "records": records,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in lead generation dashboard endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/lead-scoring/conversion/train", response_model=Dict[str, Any], summary="Train Conversion Model From Historical Leads")
async def train_lead_conversion_model(
    limit: int = Query(5000, ge=50, le=50000),
    min_rows: int = Query(40, ge=10, le=5000),
):
    """
    Retrain conversion model from historical lead outcomes (closed-won vs lost style statuses).
    """
    try:
        ml_service = get_ml_service()
        collection = getattr(ml_service, "collection", None)

        if collection is None:
            raise HTTPException(status_code=503, detail="Historical training source unavailable (MongoDB not connected)")

        projection = {
            "industry": 1,
            "budget": 1,
            "response_speed": 1,
            "meeting_count": 1,
            "email_open_rate": 1,
            "website_visits": 1,
            "outcome": 1,
            "deal_outcome": 1,
            "deal_status": 1,
            "status": 1,
            "interview_status": 1,
            "converted": 1,
            "is_converted": 1,
        }

        historical_records = list(collection.find({}, projection).limit(limit))
        modules = get_conversion_lead_scoring_modules()
        trainer = modules["train_from_historical_data"]

        metadata = trainer(historical_records, min_rows=min_rows)
        return {
            "success": True,
            "message": "Conversion model trained from historical closed outcomes",
            "trained_rows": metadata.get("dataset_rows", 0),
            "metadata": metadata,
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Error in conversion train endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/lead/{unique_id}", summary="Get Lead by Unique ID")
async def get_lead(unique_id: str):
    """
    Retrieve a specific lead by its unique ID.
    """
    try:
        ml_service = get_ml_service()
        lead = ml_service.get_lead_with_prediction(unique_id)
        
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        # Clean up MongoDB ObjectId for JSON serialization
        if '_id' in lead:
            lead['_id'] = str(lead['_id'])
        
        return {
            "success": True,
            "lead": lead
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/candidate/{candidate_id}", summary="Get Candidate by Unique ID or Mongo ID")
async def get_candidate(candidate_id: str):
    """Retrieve a candidate by unique_id first, then fallback to MongoDB _id."""
    try:
        ml_service = get_ml_service()

        lead = ml_service.get_lead_with_prediction(candidate_id)
        if not lead and getattr(ml_service, "collection", None) is not None:
            try:
                lead = ml_service.collection.find_one({"_id": ObjectId(candidate_id)})
                if lead:
                    lead = ml_service._normalize_lead_for_response(lead)
            except Exception:
                lead = None

        if not lead:
            raise HTTPException(status_code=404, detail="Candidate not found")

        if "_id" in lead:
            lead["_id"] = str(lead["_id"])

        return {
            "success": True,
            "candidate": lead,
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching candidate: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch candidate")

@app.get("/leads/temperature/{temperature}", summary="Get Leads by Temperature")
async def get_leads_by_temperature(
    temperature: str,  # Path parameter - no Query() needed
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get leads filtered by predicted temperature.
    Temperature must be one of: Hot, Warm, Cold
    """
    try:
        # Validate temperature parameter
        if temperature not in ["Hot", "Warm", "Cold"]:
            raise HTTPException(status_code=400, detail="Temperature must be Hot, Warm, or Cold")
        
        ml_service = get_ml_service()
        leads = ml_service.get_leads_by_temperature(temperature, limit)
        
        # Clean up MongoDB ObjectIds
        for lead in leads:
            if '_id' in lead:
                lead['_id'] = str(lead['_id'])
        
        return {
            "success": True,
            "temperature": temperature,
            "count": len(leads),
            "leads": leads
        }
        
    except Exception as e:
        logging.error(f"Error fetching leads by temperature: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats", response_model=Dict[str, Any], summary="Get Prediction Statistics")
async def get_prediction_statistics():
    """
    Get overall statistics about ML predictions.
    """
    try:
        ml_service = get_ml_service()
        stats = ml_service.get_prediction_stats()
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        logging.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sales-forecast", response_model=Dict[str, Any], summary="Get Sales Forecast")
async def get_sales_forecast(
    limit: int = Query(500, ge=20, le=2000),
    months: int = Query(6, ge=3, le=24),
):
    """Generate sales forecasting metrics for revenue, pipeline health, and closure trends."""
    try:
        ml_service = get_ml_service()
        leads = ml_service.get_all_leads_with_predictions(limit)

        # Ensure JSON-safe Mongo IDs for downstream consumers.
        for lead in leads:
            if isinstance(lead, dict) and '_id' in lead and isinstance(lead['_id'], ObjectId):
                lead['_id'] = str(lead['_id'])

        forecast = generate_sales_forecast_report(leads, months=months)

        return {
            "success": True,
            "forecast": forecast,
            "count": len(leads),
        }
    except Exception as e:
        logging.error(f"Error generating sales forecast: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate sales forecast")

@app.post("/batch-predict", summary="Batch Process Leads")
async def batch_predict_leads(
    background_tasks: BackgroundTasks,
    limit: int = Query(50, ge=1, le=200)
):
    """
    Process multiple leads from MongoDB with ML predictions in the background.
    """
    try:
        def process_batch():
            ml_service = get_ml_service()
            ml_service.batch_predict_leads(limit)
        
        background_tasks.add_task(process_batch)
        
        return {
            "success": True,
            "message": f"Batch processing of up to {limit} leads started",
            "status": "processing"
        }
        
    except Exception as e:
        logging.error(f"Error starting batch process: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai-insights/generate", response_model=AIInsightsGenerateResponse, summary="Generate AI Sales Insights")
async def generate_ai_insights(
    source_type: str = Form(...),
    conversation_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
):
    """Generate structured AI sales insights from transcript/chat/notes and store in MongoDB."""
    try:
        file_name = file.filename if file else None
        file_bytes = await file.read() if file else None

        service = get_ai_insights_service()
        result = service.generate_and_store(
            source_type=source_type,
            conversation_text=conversation_text,
            file_name=file_name,
            file_bytes=file_bytes,
        )

        conversation_intelligence_stored = False
        conversation_intelligence_record_id = None

        # Optionally chain AI Insights input into Conversation Intelligence so dashboard metrics populate.
        auto_chain_enabled = os.getenv("CONV_INTELLIGENCE_AUTO_FROM_AI_INSIGHTS", "true").lower() == "true"
        resolved_text = str(result.get("resolved_text") or "").strip()

        if auto_chain_enabled and resolved_text:
            try:
                ci_service = get_conversation_intelligence_service()
                ci_result = await ci_service.analyze_conversation(
                    {
                        "source_type": source_type,
                        "conversation_text": resolved_text,
                        "metadata": {
                            "source": "ai_insights",
                            "ai_insights_record_id": result.get("record_id"),
                        },
                        "persist": True,
                    }
                )
                conversation_intelligence_stored = bool(ci_result.get("stored"))
                conversation_intelligence_record_id = ci_result.get("record_id")
            except Exception as ci_error:
                logging.warning(f"Conversation intelligence auto-chain failed: {ci_error}")

        return {
            "success": True,
            "insights": result["insights"],
            "record_id": result.get("record_id"),
            "stored": bool(result.get("stored")),
            "conversation_intelligence_stored": conversation_intelligence_stored,
            "conversation_intelligence_record_id": conversation_intelligence_record_id,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"AI insights generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI insights")


@app.post("/conversation-intelligence/analyze", summary="Analyze Conversation Intelligence")
async def analyze_conversation_intelligence(payload: ConversationIntelligenceRequest):
    """Analyze chat, email, or transcript inputs and compute intent/risk scores."""
    try:
        service = get_conversation_intelligence_service()
        result = await service.analyze_conversation(payload.model_dump(exclude_none=True))
        return {
            "success": True,
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"Conversation intelligence analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to analyze conversation intelligence")


@app.get("/conversation-intelligence/lead/{lead_id}", summary="Get Latest Conversation Intelligence For Lead")
async def get_lead_conversation_intelligence(lead_id: str):
    """Fetch the most recent conversation intelligence record for a lead."""
    try:
        service = get_conversation_intelligence_service()
        record = await service.get_latest_for_lead(lead_id)
        return {
            "success": True,
            "record": record,
        }
    except Exception as e:
        logging.error(f"Failed to fetch conversation intelligence for lead {lead_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch conversation intelligence")


@app.get("/conversation-intelligence/overview", summary="Get Conversation Intelligence Overview")
async def get_conversation_intelligence_overview(limit: int = Query(200, ge=10, le=2000)):
    """Return aggregate conversation-intelligence metrics for dashboard cards."""
    try:
        service = get_conversation_intelligence_service()
        overview = await service.get_overview(limit=limit)
        return {
            "success": True,
            "overview": overview,
        }
    except Exception as e:
        logging.error(f"Failed to fetch conversation intelligence overview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch conversation intelligence overview")


@app.post("/lead-enrichment/enrich-company", response_model=CompanyEnrichmentResponse, summary="Enrich Company Data")
async def enrich_company_data(payload: CompanyEnrichmentRequest):
    """Generate AI company intelligence from company inputs using moved enrichment modules."""
    try:
        modules = get_lead_enrichment_modules()
        from serpapi_service import build_search_context, pick_best_website, search_google_business_results

        company = payload.company_name.strip()
        website = (payload.company_website or "").strip()
        email = str(payload.company_email).strip() if payload.company_email else ""
        location = (payload.company_location or "").strip()

        if not company:
            raise HTTPException(status_code=400, detail="company_name is required")

        discovery_query = f"{company} {location}".strip()
        serp_results: List[Dict[str, str]] = []

        if not website:
            try:
                serp_results = search_google_business_results(discovery_query, num=6)
                discovered_website = pick_best_website(serp_results)
                if discovered_website:
                    website = discovered_website
            except Exception as serp_error:
                logging.warning(f"SerpApi enrichment discovery failed for {company}: {serp_error}")

        domain = modules["extract_domain"](email, website)
        website_content = modules["scrape_website"](website) if website else ""
        if not website_content and serp_results:
            website_content = build_search_context(serp_results, max_items=6)

        intelligence = modules["generate_company_intelligence"](company, website_content)
        intelligence["serpapi_used"] = bool(serp_results)
        intelligence["search_result_count"] = len(serp_results)
        intelligence["discovery_query"] = discovery_query
        intelligence["discovered_website"] = website or None
        intelligence["search_preview"] = serp_results[:3]

        return {
            "success": True,
            "company": company,
            "domain": domain,
            "intelligence": intelligence,
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Lead enrichment error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to enrich company data")


@app.post("/chatbot/chat", summary="CRM Chatbot Tool Router")
async def chatbot_chat(payload: ChatbotChatRequest):
    """Handle chatbot prompts and route to CRM tools via Gemini tool-calling."""
    try:
        from chatbot import handle_chat_request_async

        context = payload.user_context if isinstance(payload.user_context, dict) else {}
        result = await handle_chat_request_async(payload.user_input, context)

        # Always return conversation memory so frontend can persist context.
        conversation_memory = context.get("conversation_memory", {})
        if isinstance(result, dict):
            result_data = result.get("data")
            if isinstance(result_data, dict):
                if "conversation_memory" not in result_data:
                    result["data"] = {**result_data, "conversation_memory": conversation_memory}
            else:
                result["data"] = {
                    "conversation_memory": conversation_memory,
                    "result": result_data,
                }

        return result
    except Exception as e:
        logging.error(f"Chatbot request failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Chatbot service unavailable")

@app.get("/leads/hot", summary="Get Hot Leads")
async def get_hot_leads(limit: int = Query(10, ge=1, le=50)):
    """Convenience endpoint to get hot leads."""
    return await get_leads_by_temperature("Hot", limit)

@app.get("/leads/warm", summary="Get Warm Leads") 
async def get_warm_leads(limit: int = Query(10, ge=1, le=50)):
    """Convenience endpoint to get warm leads."""
    return await get_leads_by_temperature("Warm", limit)

@app.get("/leads/cold", summary="Get Cold Leads")
async def get_cold_leads(limit: int = Query(10, ge=1, le=50)):
    """Convenience endpoint to get cold leads."""
    return await get_leads_by_temperature("Cold", limit)

@app.get("/leads", summary="Get All Leads")
async def get_all_leads(limit: int = Query(50, ge=1, le=200)):
    """Get all leads from MongoDB with ML predictions."""
    try:
        logging.info(f"[API] Fetching leads with limit={limit}")
        ml_service = get_ml_service()
        leads = ml_service.get_all_leads_with_predictions(limit)
        
        logging.info(f"[API] ML service returned {len(leads)} leads")
        
        # Clean up MongoDB ObjectIds for JSON serialization
        for lead in leads:
            if '_id' in lead and isinstance(lead['_id'], ObjectId):
                lead['_id'] = str(lead['_id'])
        
        response = {
            "success": True,
            "count": len(leads),
            "leads": leads
        }
        
        logging.info(f"[API] Returning {len(leads)} leads to frontend")
        return response
        
    except Exception as e:
        logging.error(f"[ERROR] Failed to fetch leads: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch leads: {str(e)}")

@app.get("/model/info", summary="Get ML Model Information")
async def get_model_info():
    """Get information about the loaded ML model."""
    try:
        ml_service = get_ml_service()
        if not hasattr(ml_service, 'temperature_model') or not ml_service.temperature_model:
            return {"success": False, "message": "Model not loaded"}
        
        metadata = getattr(ml_service, 'model_metadata', {})
        enhancer = getattr(ml_service, 'prediction_enhancer', None)
        enhancer_config = getattr(enhancer, 'config', None)

        confidence_threshold = 0.70
        calibration_enabled = False
        rule_engine_enabled = False
        llm_fallback_enabled = False

        if enhancer_config is not None:
            try:
                confidence_threshold = float(getattr(enhancer_config, 'confidence_threshold', 0.70))
            except Exception:
                confidence_threshold = 0.70
            calibration_enabled = bool(getattr(enhancer_config, 'calibration_enabled', False))
            rule_engine_enabled = bool(getattr(enhancer_config, 'rule_engine_enabled', False))
            llm_fallback_enabled = bool(getattr(enhancer_config, 'llm_fallback_enabled', False))
        
        return {
            "success": True,
            "model_info": {
                "model_type": metadata.get('model_name', 'Unknown'),
                "training_date": metadata.get('training_date', 'Unknown'),
                "accuracy": metadata.get('performance', {}).get('accuracy', 0),
                "features_count": metadata.get('features_count', 0),
                "target_classes": metadata.get('target_classes', []),
                "inference_pipeline": {
                    "base_model": "Random Forest",
                    "probability_calibration": "isotonic" if calibration_enabled else "disabled",
                    "hybrid_rule_engine": "enabled" if rule_engine_enabled else "disabled",
                    "uncertainty_detection": {
                        "enabled": True,
                        "confidence_threshold": confidence_threshold,
                    },
                    "llm_fallback": "enabled" if llm_fallback_enabled else "disabled",
                },
                "loaded": True
            }
        }
        
    except Exception as e:
        logging.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Authentication endpoints
@app.post("/auth/signup", summary="User Signup")
@app.post("/api/auth/signup", summary="User Signup (Legacy)", include_in_schema=False)
async def signup_user(user_data: UserSignupRequest):
    """Register a new user."""
    try:
        auth_service = get_auth_service()
        
        # Convert Pydantic model - try real auth first, then dev
        try:
            from auth_service import UserSignup
        except:
            from auth_service_dev import UserSignup
        
        signup_payload = user_data.model_dump()
        signup_payload["role"] = "admin"
        signup_data = UserSignup(**signup_payload)
        result = auth_service.register_user(signup_data)
        
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "success": True,
            "message": "User registered successfully",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create account: {str(e)}")

@app.post("/auth/login", summary="User Login")
@app.post("/api/auth/login", summary="User Login (Legacy)", include_in_schema=False)
async def login_user(login_data: UserLoginRequest):
    """Login a user."""
    try:
        auth_service = get_auth_service()
        
        # Convert Pydantic model - try real auth first, then dev
        try:
            from auth_service import UserLogin
        except:
            from auth_service_dev import UserLogin
        
        login_request = UserLogin(**login_data.model_dump())
        result = auth_service.login_user(login_request)
        
        if 'error' in result:
            raise HTTPException(status_code=401, detail=result['error'])
        
        return {
            "success": True,
            "message": "Login successful",
            **result
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    detail = getattr(exc, 'detail', 'Endpoint not found')
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": "Endpoint not found", "detail": str(detail)}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    detail = getattr(exc, 'detail', str(exc))
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error", "detail": str(detail)}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc):
    """Catch all other exceptions."""
    logging.error(f"Unhandled exception: {exc}")
    import traceback
    logging.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "An unexpected error occurred", "detail": str(exc)}
    )

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting AI-Powered CRM ML Prediction API...")
    print("📊 ML Model: Lead Temperature Prediction")
    print("🔗 API Documentation: http://localhost:8000/docs")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )