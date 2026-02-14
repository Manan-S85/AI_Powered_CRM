"""
Unified Backend Startup Script for AI-Powered CRM
Handles ML API, authentication, and all backend services.
"""
import os
import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_environment():
    """Check if all required environment variables are set."""
    logger.info("🔍 Checking environment configuration...")
    
    required_vars = [
        'MONGODB_URI',
        'DB_NAME',
        'JWT_SECRET_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        logger.error("   Please check your .env file")
        return False
    
    logger.info("✅ Environment configuration OK")
    return True

def check_mongodb():
    """Test MongoDB connection."""
    logger.info("🔍 Testing MongoDB connection...")
    
    try:
        from pymongo import MongoClient
        from dotenv import load_dotenv
        
        load_dotenv()
        
        mongo_uri = os.getenv('MONGODB_URI')
        db_name = os.getenv('DB_NAME', 'ai_crm_db')
        
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000
        )
        
        # Test connection
        client.admin.command('ping')
        client.close()
        
        logger.info("✅ MongoDB connection successful")
        return True
        
    except Exception as e:
        logger.warning(f"⚠️ MongoDB connection failed: {e}")
        logger.warning("   Backend will start but authentication may not work")
        return False

def start_backend():
    """Start the FastAPI backend server."""
    logger.info("="*60)
    logger.info("🚀 Starting AI-Powered CRM Backend Server")
    logger.info("="*60)
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Check prerequisites
    env_ok = check_environment()
    if not env_ok:
        logger.error("❌ Environment check failed. Please fix configuration.")
        sys.exit(1)
    
    mongo_ok = check_mongodb()
    
    # Start FastAPI server
    logger.info("\n📡 Starting FastAPI server...")
    logger.info("   Host: 0.0.0.0")
    logger.info("   Port: 8000")
    logger.info("   API Docs: http://localhost:8000/docs")
    logger.info("   MongoDB: " + ("✅ Connected" if mongo_ok else "⚠️ Not connected"))
    logger.info("\n" + "="*60)
    
    import uvicorn
    from ml_prediction_api import app
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )

if __name__ == "__main__":
    try:
        start_backend()
    except KeyboardInterrupt:
        logger.info("\n\n👋 Backend server stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n❌ Failed to start backend: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
