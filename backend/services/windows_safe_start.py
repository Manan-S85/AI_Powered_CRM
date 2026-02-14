#!/usr/bin/env python3
"""
Windows-Safe Backend Startup Script
This avoids Unicode characters that cause terminal issues on Windows
"""

import os
import sys
import subprocess
from pathlib import Path

def print_safe(message):
    """Print messages that are safe for Windows terminal."""
    # Replace Unicode characters with ASCII equivalents
    safe_message = message.replace('✓', '[OK]').replace('✗', '[ERROR]').replace('🚀', '>>').replace('⚠️', '[WARN]')
    print(safe_message)

def install_dependencies():
    """Install required dependencies safely."""
    print_safe("Installing backend dependencies...")
    
    dependencies = [
        "fastapi",
        "uvicorn[standard]", 
        "python-dotenv",
        "pydantic[email]",
        "pymongo",
        "pandas",
        "scikit-learn",
        "joblib",
        "werkzeug",
        "PyJWT"
    ]
    
    for dep in dependencies:
        try:
            print_safe(f"Installing {dep}...")
            result = subprocess.run([
                sys.executable, "-m", "pip", "install", dep
            ], capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0:
                print_safe(f"[OK] {dep} installed")
            else:
                print_safe(f"[ERROR] {dep} failed: {result.stderr}")
        except Exception as e:
            print_safe(f"[ERROR] {dep} install failed: {e}")

def test_imports():
    """Test if required imports work."""
    print_safe("Testing imports...")
    
    try:
        import fastapi
        print_safe("[OK] FastAPI available")
        
        import uvicorn
        print_safe("[OK] Uvicorn available")
        
        import pydantic
        print_safe("[OK] Pydantic available")
        
        return True
    except ImportError as e:
        print_safe(f"[ERROR] Import failed: {e}")
        return False

def start_backend_safe():
    """Start backend with safe error handling."""
    print_safe("Starting AI-Powered CRM Backend...")
    
    try:
        # Set environment variables for better Windows compatibility
        os.environ['PYTHONIOENCODING'] = 'utf-8'
        os.environ['PYTHONLEGACYWINDOWSSTDIO'] = '1'
        os.environ['PYTHONUTF8'] = '1'
        
        # Import and start
        import uvicorn
        print_safe("[OK] Uvicorn imported")
        
        # Import app - this is where hangs typically occur
        print_safe("Loading ML Prediction API...")
        from ml_prediction_api import app
        
        print_safe(f"[OK] App loaded: {app.title}")
        print_safe("")
        print_safe("Server starting on http://localhost:8000")
        print_safe("API docs at http://localhost:8000/docs")
        print_safe("Health check at http://localhost:8000/health")
        print_safe("")
        print_safe("Press Ctrl+C to stop the server")
        print_safe("" + "=" * 50)
        
        # Start server with Windows-safe configurations
        uvicorn.run(
            app,
            host="0.0.0.0",  # Accept connections from all interfaces
            port=8000,
            log_level="info",
            access_log=False,  # Reduce terminal output issues
            timeout_keep_alive=30,  # Prevent hanging connections
            limit_concurrency=100  # Reasonable limit
        )
        
    except KeyboardInterrupt:
        print_safe("")
        print_safe("Server stopped by user")
        return True
    except Exception as e:
        print_safe(f"[ERROR] Server failed: {e}")
        import traceback
        print_safe(f"[DEBUG] {traceback.format_exc()}")
        return False
    
    return True

def main():
    """Main function with comprehensive error handling."""
    print_safe("=" * 50)
    print_safe("AI-Powered CRM Backend - Windows Safe Startup")
    print_safe("=" * 50)
    
    # Change to correct directory
    script_dir = Path(__file__).parent
    services_dir = script_dir
    backend_dir = script_dir.parent
    project_dir = backend_dir.parent
    
    print_safe(f"Working directory: {services_dir}")
    os.chdir(str(services_dir))
    
    # Add to path
    sys.path.insert(0, str(services_dir))
    
    # Load environment
    try:
        from dotenv import load_dotenv
        env_file = project_dir / '.env'
        if env_file.exists():
            load_dotenv(str(env_file))
            print_safe("[OK] Environment loaded")
        else:
            print_safe(f"[WARN] .env file not found at {env_file}")
    except Exception as e:
        print_safe(f"[ERROR] Environment loading failed: {e}")
    
    # Check and install dependencies
    if not test_imports():
        print_safe("Missing dependencies. Installing...")
        install_dependencies()
        
        # Test again
        if not test_imports():
            print_safe("[ERROR] Could not install required dependencies")
            print_safe("Please run: pip install fastapi uvicorn python-dotenv")
            return 1
    
    # Start backend
    if start_backend_safe():
        print_safe("[OK] Backend started successfully")
        return 0
    else:
        print_safe("[ERROR] Backend failed to start")
        return 1

if __name__ == "__main__":
    exit_code = main()
    
    # Safe pause for Windows
    print_safe("Press Enter to continue...")
    try:
        input()
    except:
        pass
    
    sys.exit(exit_code)