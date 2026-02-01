#!/usr/bin/env python3
"""
FastAPI Server Startup Script
Runs the complete AI-Powered CRM FastAPI backend
Data Flow: Google Forms → Google Sheets → FastAPI → MongoDB → ML Model → Results → Frontend
"""

import os
import sys
import asyncio
import logging
from pathlib import Path

# Add current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Load environment variables from parent directory
from dotenv import load_dotenv
load_dotenv(current_dir.parent / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def startup_checks():
    """Perform startup checks"""
    try:
        # Check environment variables
        required_env_vars = ['MONGODB_URI']
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]
        
        if missing_vars:
            logger.warning(f"Missing environment variables: {missing_vars}")
        else:
            logger.info("Environment variables check passed")

        # Check ML model files
        model_paths = [
            Path("ml_model/lead_model.pkl"),
            Path("../ml_model/lead_model.pkl"), 
            Path("lead_model.pkl")
        ]
        
        model_found = any(path.exists() for path in model_paths)
        if model_found:
            logger.info("ML model files found")
        else:
            logger.warning("ML model files not found - ML predictions may fail")

        # Test MongoDB connection
        from services.mongodb_service import MongoDBService
        db_service = MongoDBService()
        connected = await db_service.connect()
        if connected:
            logger.info("MongoDB connection successful")
        else:
            logger.error("MongoDB connection failed")

        logger.info("Startup checks completed")
        
    except Exception as e:
        logger.error(f"Error in startup checks: {e}")

if __name__ == "__main__":
    import uvicorn
    
    logger.info("=" * 80)
    logger.info("🚀 Starting AI-Powered CRM FastAPI Backend")
    logger.info("=" * 80)
    logger.info("Data Flow: Google Forms → Google Sheets → FastAPI → MongoDB → ML → Frontend")
    logger.info("=" * 80)
    
    # Run startup checks
    asyncio.run(startup_checks())
    
    # Start FastAPI server
    logger.info("Starting FastAPI server...")
    uvicorn.run(
        "fastapi_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )