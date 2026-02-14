#!/usr/bin/env python3
"""
Backend Startup Script - Simple entry point
For Windows, use windows_safe_start.py instead
"""

import sys
import os
from pathlib import Path

def main():
    """Main entry point for backend startup."""
    
    # Check if on Windows
    if sys.platform == "win32":
        print("Windows detected - using safe startup script...")
        try:
            import windows_safe_start
            return windows_safe_start.main()
        except ImportError:
            print("Error: windows_safe_start.py not found")
            return 1
    
    # For Unix-like systems (Linux/Mac)
    print("Starting AI-Powered CRM Backend...")
    
    try:
        import uvicorn
        from ml_prediction_api import app
        
        print(f"✓ App loaded: {app.title}")
        print("Server starting on http://localhost:8000")
        print("API docs at http://localhost:8000/docs")
        print("\nPress Ctrl+C to stop the server\n")
        
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="info"
        )
        
        return 0
        
    except KeyboardInterrupt:
        print("\nServer stopped by user")
        return 0
    except Exception as e:
        print(f"Error starting server: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
