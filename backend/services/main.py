"""
FastAPI service for ML predictions and lead management.
This provides REST API endpoints for the frontend to access ML predictions.
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
import logging
import os
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
    company_email: Optional[EmailStr] = None
    
    # Legacy fields (optional for backward compatibility)
    availability: Optional[str] = None
    interview_status: Optional[str] = None
    resume_upload: Optional[str] = None

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


class CompanyEnrichmentRequest(BaseModel):
    company_name: str
    company_website: Optional[str] = None
    company_email: Optional[EmailStr] = None


class CompanyEnrichmentResponse(BaseModel):
    success: bool
    company: str
    domain: Optional[str]
    intelligence: Dict[str, Any]

_cached_auth_service = None
_lead_enrichment_modules = None

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

@app.post("/predict", response_model=Dict[str, Any], summary="Predict Lead Temperature")
async def predict_lead_temperature(lead: LeadInput):
    """
    Predict the temperature (Hot/Warm/Cold) for a new lead.
    """
    try:
        # Convert to dict
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
        
    except Exception as e:
        logging.error(f"Error in predict endpoint: {e}")
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

        return {
            "success": True,
            "insights": result["insights"],
            "record_id": result.get("record_id"),
            "stored": bool(result.get("stored")),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.error(f"AI insights generation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate AI insights")


@app.post("/lead-enrichment/enrich-company", response_model=CompanyEnrichmentResponse, summary="Enrich Company Data")
async def enrich_company_data(payload: CompanyEnrichmentRequest):
    """Generate AI company intelligence from company inputs using moved enrichment modules."""
    try:
        modules = get_lead_enrichment_modules()

        company = payload.company_name.strip()
        website = (payload.company_website or "").strip()
        email = str(payload.company_email).strip() if payload.company_email else ""

        if not company:
            raise HTTPException(status_code=400, detail="company_name is required")

        domain = modules["extract_domain"](email, website)
        website_content = modules["scrape_website"](website) if website else ""
        intelligence = modules["generate_company_intelligence"](company, website_content)

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
        
        return {
            "success": True,
            "model_info": {
                "model_type": metadata.get('model_name', 'Unknown'),
                "training_date": metadata.get('training_date', 'Unknown'),
                "accuracy": metadata.get('performance', {}).get('accuracy', 0),
                "features_count": metadata.get('features_count', 0),
                "target_classes": metadata.get('target_classes', []),
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