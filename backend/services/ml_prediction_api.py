"""
FastAPI service for ML predictions and lead management.
This provides REST API endpoints for the frontend to access ML predictions.
"""

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from ml_prediction_service import lead_scoring_service

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
class LeadInput(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role_position: str
    skills: Optional[str] = None
    resume_upload: Optional[str] = None
    linkedin_profile: Optional[str] = None
    years_of_experience: Optional[int] = 0
    expected_salary: Optional[int] = 0
    location: Optional[str] = None
    availability: Optional[str] = "Unknown"
    interview_status: Optional[str] = "New"

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

@app.post("/predict", response_model=Dict[str, Any], summary="Predict Lead Temperature")
async def predict_lead_temperature(lead: LeadInput):
    """
    Predict the temperature (Hot/Warm/Cold) for a new lead.
    """
    try:
        # Convert to dict
        lead_data = lead.dict()
        
        # Process with ML
        result = lead_scoring_service.process_lead_with_ml(lead_data)
        
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
        lead = lead_scoring_service.get_lead_with_prediction(unique_id)
        
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

@app.get("/leads/temperature/{temperature}", summary="Get Leads by Temperature")
async def get_leads_by_temperature(
    temperature: str = Query(..., regex="^(Hot|Warm|Cold)$"),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get leads filtered by predicted temperature.
    Temperature must be one of: Hot, Warm, Cold
    """
    try:
        leads = lead_scoring_service.get_leads_by_temperature(temperature, limit)
        
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
        stats = lead_scoring_service.get_prediction_stats()
        
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
            lead_scoring_service.batch_predict_leads(limit)
        
        background_tasks.add_task(process_batch)
        
        return {
            "success": True,
            "message": f"Batch processing of up to {limit} leads started",
            "status": "processing"
        }
        
    except Exception as e:
        logging.error(f"Error starting batch process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/model/info", summary="Get ML Model Information")
async def get_model_info():
    """Get information about the loaded ML model."""
    try:
        if not lead_scoring_service.temperature_model:
            return {"success": False, "message": "Model not loaded"}
        
        metadata = lead_scoring_service.model_metadata
        
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

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"success": False, "error": "Endpoint not found", "detail": str(exc.detail)}

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return {"success": False, "error": "Internal server error", "detail": str(exc.detail)}

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting AI-Powered CRM ML Prediction API...")
    print("📊 ML Model: Lead Temperature Prediction")
    print("🔗 API Documentation: http://localhost:8001/docs")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )