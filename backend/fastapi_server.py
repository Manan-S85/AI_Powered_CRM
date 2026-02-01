#!/usr/bin/env python3
"""
FastAPI Backend for AI-Powered CRM
Handles the complete data pipeline:
Google Forms → Google Sheets → FastAPI → MongoDB → ML Model → Results → Frontend
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
import asyncio
import logging
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../.env')

# Import our services
from services.google_sheets_service import GoogleSheetsService
from services.mongodb_service import MongoDBService
from services.ml_service import MLService
from predictor import classify_lead

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI-Powered CRM Backend",
    description="FastAPI backend for Google Forms → ML Pipeline",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
sheets_service = GoogleSheetsService()
db_service = MongoDBService()
ml_service = MLService()

# Pydantic models
class LeadData(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    message: Optional[str] = ""
    budget: Optional[str] = None
    timeline: Optional[str] = None
    urgency: Optional[str] = "medium"
    source: str = "google_forms"

class PipelineResponse(BaseModel):
    success: bool
    message: str
    data: Dict[str, Any]

# API Routes

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "AI-Powered CRM FastAPI Backend",
        "version": "1.0.0",
        "pipeline_flow": "Google Forms → Google Sheets → FastAPI → MongoDB → ML Model → Results → Frontend"
    }

@app.post("/api/pipeline/sync-sheets", response_model=PipelineResponse)
async def sync_google_sheets(background_tasks: BackgroundTasks):
    """
    Step 1: Fetch data from Google Sheets (connected to Google Forms)
    """
    try:
        logger.info("Starting Google Sheets sync...")
        
        # Fetch data from Google Sheets
        sheet_data = await sheets_service.fetch_leads_from_sheet()
        
        if not sheet_data:
            return PipelineResponse(
                success=True,
                message="No new data found in Google Sheets",
                data={"leads_processed": 0}
            )

        # Store in MongoDB and process with ML in background
        background_tasks.add_task(process_leads_pipeline, sheet_data)
        
        return PipelineResponse(
            success=True,
            message=f"Synced {len(sheet_data)} leads from Google Sheets, processing in background",
            data={"leads_synced": len(sheet_data)}
        )
        
    except Exception as e:
        logger.error(f"Error syncing Google Sheets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pipeline/process-leads", response_model=PipelineResponse)
async def process_unprocessed_leads():
    """
    Process leads that haven't been scored by ML yet
    """
    try:
        # Get unprocessed leads from MongoDB
        unprocessed_leads = await db_service.get_unprocessed_leads()
        
        if not unprocessed_leads:
            return PipelineResponse(
                success=True,
                message="No unprocessed leads found",
                data={"processed": 0}
            )

        # Process through ML pipeline
        processed_count = 0
        for lead in unprocessed_leads:
            try:
                # Step 1: Extract ML features
                ml_features = ml_service.extract_features(lead)
                
                # Step 2: Get ML prediction
                prediction = classify_lead(
                    ml_features.get("message", ""),
                    ml_features.get("has_budget", False),
                    ml_features.get("has_timeline", False),
                    ml_features.get("urgency", 2)
                )
                
                # Step 3: Calculate lead score
                lead_score = ml_service.calculate_score(prediction, ml_features)
                
                # Step 4: Save results back to MongoDB
                await db_service.update_lead_with_ml_results(
                    lead["_id"],
                    prediction,
                    lead_score,
                    ml_features
                )
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing lead {lead.get('_id')}: {e}")
                continue

        return PipelineResponse(
            success=True,
            message=f"Processed {processed_count} leads through ML pipeline",
            data={"processed": processed_count, "total": len(unprocessed_leads)}
        )
        
    except Exception as e:
        logger.error(f"Error processing leads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pipeline/full-pipeline", response_model=PipelineResponse)
async def run_full_pipeline(background_tasks: BackgroundTasks):
    """
    Complete pipeline: Google Sheets → MongoDB → ML → Results → Ready for Frontend
    """
    try:
        results = {}
        
        # Step 1: Sync Google Sheets
        logger.info("Step 1: Fetching from Google Sheets...")
        sheet_data = await sheets_service.fetch_leads_from_sheet()
        results["sheets_sync"] = {"leads_found": len(sheet_data)}
        
        # Step 2: Store in MongoDB
        logger.info("Step 2: Storing in MongoDB...")
        stored_leads = []
        for lead_data in sheet_data:
            try:
                lead_id = await db_service.store_lead(lead_data)
                stored_leads.append({"id": lead_id, "data": lead_data})
            except Exception as e:
                logger.error(f"Error storing lead: {e}")
                
        results["mongodb_storage"] = {"leads_stored": len(stored_leads)}
        
        # Step 3: Process through ML Model
        logger.info("Step 3: Processing through ML Model...")
        ml_processed = 0
        for lead_info in stored_leads:
            try:
                lead_data = lead_info["data"]
                lead_id = lead_info["id"]
                
                # Extract features for ML
                ml_features = ml_service.extract_features(lead_data)
                
                # Get ML prediction
                prediction = classify_lead(
                    ml_features.get("message", ""),
                    ml_features.get("has_budget", False),
                    ml_features.get("has_timeline", False),
                    ml_features.get("urgency", 2)
                )
                
                # Calculate lead score
                lead_score = ml_service.calculate_score(prediction, ml_features)
                
                # Step 4: Save ML results back to MongoDB
                await db_service.update_lead_with_ml_results(
                    lead_id,
                    prediction,
                    lead_score,
                    ml_features
                )
                
                ml_processed += 1
                
            except Exception as e:
                logger.error(f"Error in ML processing: {e}")
                
        results["ml_processing"] = {"leads_processed": ml_processed}
        
        # Step 5: Ready for Frontend Dashboard
        results["pipeline_completed"] = True
        results["completed_at"] = datetime.now().isoformat()
        results["ready_for_frontend"] = True
        
        return PipelineResponse(
            success=True,
            message="Full pipeline completed successfully",
            data=results
        )
        
    except Exception as e:
        logger.error(f"Error in full pipeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/leads", response_model=List[Dict[str, Any]])
async def get_leads(skip: int = 0, limit: int = 100):
    """
    Get leads for Frontend Dashboard
    Returns leads with ML scores and predictions
    """
    try:
        leads = await db_service.get_leads_for_frontend(skip, limit)
        return leads
    except Exception as e:
        logger.error(f"Error fetching leads: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pipeline/status")
async def get_pipeline_status():
    """
    Get current pipeline status and statistics
    """
    try:
        stats = await db_service.get_pipeline_statistics()
        return {
            "pipeline_status": "active",
            "data_flow": "Google Forms → Google Sheets → FastAPI → MongoDB → ML Model → Results → Frontend Dashboard",
            "statistics": stats,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting pipeline status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Background task for processing leads
async def process_leads_pipeline(sheet_data: List[Dict[str, Any]]):
    """
    Background task to process the complete pipeline
    """
    try:
        for lead_data in sheet_data:
            # Store in MongoDB
            lead_id = await db_service.store_lead(lead_data)
            
            # Process with ML
            ml_features = ml_service.extract_features(lead_data)
            prediction = classify_lead(
                ml_features.get("message", ""),
                ml_features.get("has_budget", False),
                ml_features.get("has_timeline", False),
                ml_features.get("urgency", 2)
            )
            lead_score = ml_service.calculate_score(prediction, ml_features)
            
            # Save results back to DB
            await db_service.update_lead_with_ml_results(
                lead_id, prediction, lead_score, ml_features
            )
            
        logger.info(f"Background processing completed for {len(sheet_data)} leads")
        
    except Exception as e:
        logger.error(f"Error in background processing: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)