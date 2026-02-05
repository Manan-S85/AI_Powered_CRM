"""
Weekly Automated Data Sync from Google Sheets to MongoDB with ML Predictions
This script runs weekly to sync data and update ML predictions.
"""
import schedule
import time
import logging
import os
import sys
from datetime import datetime

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import our services
from mongo_to_sheets import main as sync_sheets_to_mongo
from ml_prediction_service import lead_scoring_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('weekly_sync.log'),
        logging.StreamHandler()
    ]
)

def weekly_sync_job():
    """Main weekly sync job that updates data and ML predictions."""
    print(f"\n🔄 Starting Weekly Sync Job - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    try:
        # Step 1: Sync Google Sheets to MongoDB
        logging.info("📊 Starting Google Sheets → MongoDB sync...")
        sync_result = sync_sheets_to_mongo()
        
        if sync_result:
            logging.info("✅ Google Sheets sync completed successfully")
        else:
            logging.error("❌ Google Sheets sync failed")
            return False
        
        # Step 2: Process any new leads with ML predictions
        logging.info("🤖 Processing leads with ML predictions...")
        
        from pymongo import MongoClient
        from dotenv import load_dotenv
        
        load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
        
        # Connect to MongoDB
        client = MongoClient(os.getenv('MONGODB_URI'))
        db = client['ai_crm_db']
        collection = db['leads']
        
        # Find leads without ML predictions
        leads_without_ml = list(collection.find({
            "$or": [
                {"ml_prediction": {"$exists": False}},
                {"ml_prediction": None},
                {"ml_prediction": {}}
            ]
        }))
        
        if leads_without_ml:
            logging.info(f"🔍 Found {len(leads_without_ml)} leads to process")
            
            processed = 0
            for lead in leads_without_ml:
                try:
                    # Clean data for processing
                    clean_data = {k: v for k, v in lead.items() 
                                if not k.startswith('_') and k not in ['ml_prediction', 'unique_id', 'processed_at']}
                    
                    # Process with ML
                    result = lead_scoring_service.process_lead_with_ml(clean_data)
                    
                    # Update database
                    collection.update_one(
                        {'_id': lead['_id']},
                        {
                            '$set': {
                                'ml_prediction': result['ml_prediction'],
                                'unique_id': result['unique_id'],
                                'processed_at': result['processed_at']
                            }
                        }
                    )
                    processed += 1
                    
                except Exception as e:
                    logging.error(f"Error processing lead {lead.get('email', 'unknown')}: {e}")
            
            logging.info(f"✅ Processed {processed} leads with ML predictions")
        else:
            logging.info("ℹ️  All leads already have ML predictions")
        
        # Step 3: Generate summary report
        total_leads = collection.count_documents({})
        hot_leads = collection.count_documents({"ml_prediction.predicted_temperature": "Hot"})
        warm_leads = collection.count_documents({"ml_prediction.predicted_temperature": "Warm"})
        cold_leads = collection.count_documents({"ml_prediction.predicted_temperature": "Cold"})
        
        print(f"\n📊 Weekly Sync Summary:")
        print(f"  • Total leads: {total_leads}")
        print(f"  • Hot leads: {hot_leads}")
        print(f"  • Warm leads: {warm_leads}")
        print(f"  • Cold leads: {cold_leads}")
        
        logging.info("🎉 Weekly sync job completed successfully")
        return True
        
    except Exception as e:
        logging.error(f"❌ Weekly sync job failed: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return False

def start_scheduler():
    """Start the weekly scheduler."""
    print("🚀 Starting Weekly CRM Data Sync Scheduler")
    print("=========================================")
    
    # Schedule the job to run every Sunday at 9:00 AM
    schedule.every().sunday.at("09:00").do(weekly_sync_job)
    
    # Also allow manual trigger for testing
    schedule.every().monday.at("09:00").do(weekly_sync_job)  # Backup
    
    print("📅 Scheduled weekly sync for:")
    print("  • Every Sunday at 9:00 AM")
    print("  • Every Monday at 9:00 AM (backup)")
    print("⏰ Scheduler is now running... Press Ctrl+C to stop")
    
    # Keep the scheduler running
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='CRM Weekly Sync Scheduler')
    parser.add_argument('--run-now', action='store_true', help='Run sync job immediately')
    parser.add_argument('--schedule', action='store_true', help='Start the weekly scheduler')
    
    args = parser.parse_args()
    
    if args.run_now:
        print("🔧 Running sync job immediately...")
        weekly_sync_job()
    elif args.schedule:
        start_scheduler()
    else:
        print("Usage:")
        print("  python weekly_sync.py --run-now    # Run sync immediately")
        print("  python weekly_sync.py --schedule   # Start weekly scheduler")