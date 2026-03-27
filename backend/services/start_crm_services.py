#!/usr/bin/env python3
"""
Startup script for AI-Powered CRM Services
Runs both the ML Prediction API and periodic sync services
"""

import os
import sys
import asyncio
import threading
import time
from datetime import datetime, timedelta
import subprocess
import logging

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('crm_services.log')
    ]
)

class CRMServiceManager:
    """Manages all CRM background services."""
    
    def __init__(self):
        self.api_process = None
        self.scheduler_thread = None
        self.running = False
        
    def start_ml_api(self):
        """Start the ML Prediction API server."""
        try:
            print("🚀 Starting ML Prediction API...")
            
            # Start the FastAPI server
            cmd = [sys.executable, "ml_prediction_api.py"]
            self.api_process = subprocess.Popen(
                cmd,
                cwd=os.path.dirname(__file__),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            time.sleep(3)  # Give it time to start
            
            if self.api_process.poll() is None:
                print("✅ ML Prediction API started successfully!")
                print("🔗 API Documentation: http://localhost:8001/docs")
                print("🔗 Health Check: http://localhost:8001/")
            else:
                print("❌ Failed to start ML Prediction API")
                
        except Exception as e:
            print(f"❌ Error starting ML API: {e}")
    
    def periodic_sync(self):
        """Run periodic Google Sheets sync."""
        print("⏰ Starting periodic sync scheduler...")
        
        while self.running:
            try:
                current_time = datetime.now()
                print(f"\\n🔄 [{current_time.strftime('%Y-%m-%d %H:%M:%S')}] Running scheduled sync...")
                
                # Run the sync script
                result = subprocess.run(
                    [sys.executable, "mongo_to_sheets.py"],
                    cwd=os.path.dirname(__file__),
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    print("✅ Scheduled sync completed successfully")
                    if result.stdout:
                        # Print only summary lines
                        lines = result.stdout.split('\\n')
                        for line in lines:
                            if any(keyword in line for keyword in ['✅', '📊', '🎉', 'completed']):
                                print(f"   {line}")
                else:
                    print(f"❌ Scheduled sync failed: {result.stderr}")
                
            except Exception as e:
                print(f"❌ Sync error: {e}")
            
            # Wait for next sync (30 minutes)
            print(f"⏳ Next sync in 30 minutes...")
            
            for i in range(1800):  # 30 minutes = 1800 seconds
                if not self.running:
                    break
                time.sleep(1)
    
    def start_scheduler(self):
        """Start the periodic scheduler in a background thread."""
        self.scheduler_thread = threading.Thread(target=self.periodic_sync, daemon=True)
        self.scheduler_thread.start()
    
    def test_ml_service(self):
        """Test the ML prediction service."""
        try:
            print("\\n🧪 Testing ML Prediction Service...")
            from ml_prediction_service import lead_scoring_service
            
            # Test sample prediction
            sample_data = {
                'name': 'Test User',
                'email': 'test@example.com',
                'role_position': 'Software Engineer',
                'skills': 'Python, Machine Learning',
                'years_of_experience': 3
            }
            
            result = lead_scoring_service.process_lead_with_ml(sample_data)
            
            if 'ml_prediction' in result and 'predicted_temperature' in result['ml_prediction']:
                temp = result['ml_prediction']['predicted_temperature']
                confidence = result['ml_prediction']['confidence']
                print(f"✅ ML Service Working - Sample prediction: {temp} ({confidence:.1%} confidence)")
                return True
            else:
                print("❌ ML Service test failed")
                return False
                
        except Exception as e:
            print(f"❌ ML Service test error: {e}")
            return False
    
    def show_status(self):
        """Show current status of all services."""
        print("\\n" + "="*60)
        print("📊 AI-POWERED CRM - SERVICE STATUS")
        print("="*60)
        
        # API Status
        if self.api_process and self.api_process.poll() is None:
            print("🟢 ML Prediction API: Running (Port 8001)")
        else:
            print("🔴 ML Prediction API: Not Running")
        
        # Scheduler Status
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            print("🟢 Sync Scheduler: Running (30min intervals)")
        else:
            print("🔴 Sync Scheduler: Not Running")
        
        # ML Service Status
        ml_status = self.test_ml_service()
        if ml_status:
            print("🟢 ML Prediction Service: Working")
        else:
            print("🔴 ML Prediction Service: Error")
        
        print("="*60)
    
    def start_all(self):
        """Start all CRM services."""
        print("🚀 AI-POWERED CRM - STARTING ALL SERVICES")
        print("="*60)
        
        self.running = True
        
        # Start ML API
        self.start_ml_api()
        
        # Start periodic scheduler
        self.start_scheduler()
        
        # Show initial status
        time.sleep(2)
        self.show_status()
        
        print("\\n🎉 All services started successfully!")
        print("\\nAvailable endpoints:")
        print("   • ML API: http://localhost:8001")
        print("   • API Docs: http://localhost:8001/docs")
        print("   • Health Check: http://localhost:8001/")
        print("\\nPress Ctrl+C to stop all services")
        
        # Keep running
        try:
            while self.running:
                time.sleep(60)
                # Show periodic status update
                if datetime.now().minute % 15 == 0:  # Every 15 minutes
                    self.show_status()
                    
        except KeyboardInterrupt:
            print("\\n🛑 Shutting down services...")
            self.stop_all()
    
    def stop_all(self):
        """Stop all services."""
        self.running = False
        
        # Stop API
        if self.api_process:
            self.api_process.terminate()
            print("✅ ML Prediction API stopped")
        
        # Scheduler will stop automatically when self.running = False
        print("✅ Sync Scheduler stopped")
        print("\\n👋 AI-Powered CRM services stopped successfully")

def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == "--api-only":
        # Start only the API
        print("🚀 Starting ML Prediction API only...")
        manager = CRMServiceManager()
        manager.start_ml_api()
        
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\\n🛑 Stopping API...")
            manager.stop_all()
    else:
        # Start all services
        manager = CRMServiceManager()
        manager.start_all()

if __name__ == "__main__":
    main()