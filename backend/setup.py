"""
CRM System Setup and Management Script
"""
import subprocess
import sys
import os
from pathlib import Path

def setup_environment():
    """Set up the Python environment and install dependencies."""
    print("🚀 Setting up CRM System Environment")
    print("=" * 40)
    
    try:
        # Install clean dependencies
        print("📦 Installing dependencies...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", "requirements_clean.txt"
        ])
        print("✅ Dependencies installed successfully")
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing dependencies: {e}")
        return False
    
    return True

def start_api_server():
    """Start the FastAPI server for frontend integration."""
    print("🌐 Starting API Server for Frontend...")
    try:
        os.chdir("services")
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "ml_prediction_api:app", 
            "--host", "0.0.0.0", 
            "--port", "8001", 
            "--reload"
        ])
    except KeyboardInterrupt:
        print("\n🛑 API Server stopped")

def run_sync_now():
    """Run data sync immediately."""
    print("🔄 Running data sync now...")
    try:
        os.chdir("services")
        subprocess.run([sys.executable, "weekly_sync.py", "--run-now"])
    except Exception as e:
        print(f"❌ Error running sync: {e}")

def start_weekly_scheduler():
    """Start the weekly scheduler service."""
    print("📅 Starting weekly scheduler...")
    try:
        os.chdir("services")
        subprocess.run([sys.executable, "weekly_sync.py", "--schedule"])
    except KeyboardInterrupt:
        print("\n🛑 Weekly scheduler stopped")

def show_usage():
    """Show usage instructions."""
    print("CRM System Management")
    print("===================")
    print()
    print("Available commands:")
    print("  python setup.py --setup       # Setup environment")
    print("  python setup.py --api         # Start API server")
    print("  python setup.py --sync        # Run sync now")
    print("  python setup.py --schedule    # Start weekly scheduler")
    print()
    print("For Windows Task Scheduler:")
    print("  Use: run_weekly_sync.bat")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        show_usage()
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "--setup":
        setup_environment()
    elif command == "--api":
        start_api_server()
    elif command == "--sync":
        run_sync_now()
    elif command == "--schedule":
        start_weekly_scheduler()
    else:
        show_usage()