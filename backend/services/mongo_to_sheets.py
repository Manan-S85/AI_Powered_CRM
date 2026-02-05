import os
import re
import gspread
import pandas as pd
from pymongo import MongoClient, UpdateOne
from oauth2client.service_account import ServiceAccountCredentials
from gspread.exceptions import APIError, SpreadsheetNotFound
import logging
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# ======================
# CONFIG
# ======================

# Google Sheets Configuration
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), 'crm-project-486509-3dff2afd54cb.json')
SPREADSHEET_NAME = os.getenv("GOOGLE_SPREADSHEET_NAME", "CRM form (Responses)")
WORKSHEET_NAME = os.getenv("GOOGLE_WORKSHEET_NAME", "Form Responses 1")

# MongoDB Configuration
MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "ai_crm_db")
COLLECTION_NAME = os.getenv("MONGODB_COLLECTION_NAME", "leads")

# Google Sheets scope
SCOPE = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive"
]

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ======================
# HELPERS
# ======================

def validate_config():
    """Validate configuration and check for required files and settings."""
    errors = []
    
    # Check credentials file
    if not os.path.exists(CREDENTIALS_FILE):
        errors.append(f"❌ Credentials file not found at: {CREDENTIALS_FILE}")
        errors.append(f"   Current directory: {os.getcwd()}")
        errors.append(f"   Please ensure the Google service account JSON file is available")
    
    # Check MongoDB URI
    if not MONGO_URI:
        errors.append("❌ MONGODB_URI not found in environment variables!")
        errors.append("   Please check your .env file")
    
    # Check spreadsheet name
    if not SPREADSHEET_NAME:
        errors.append("❌ Please configure GOOGLE_SPREADSHEET_NAME")
    
    if errors:
        for error in errors:
            print(error)
        print("\n🔧 Configuration help:")
        print("   Set environment variables or update the config section in this file.")
        return False
    
    return True

def normalize_columns(df):
    """Normalize column names to be MongoDB-friendly."""
    # Create a mapping for the new column variations
    column_mapping = {
        'Full Name': 'full_name',
        'Mobile Number': 'mobile_number',
        'Highest Education': 'highest_education', 
        'Applied Position': 'applied_position',
        'Years of Experience': 'years_of_experience',
        'Primary Skills': 'primary_skills',
        'Current Location': 'current_location',
        'LinkedIn profile': 'linkedin_profile',
        'Expected Salary': 'expected_salary',
        'Willing to Relocate': 'willing_to_relocate'
    }
    
    # Apply direct mapping first
    df = df.rename(columns=column_mapping)
    
    # Then normalize remaining columns
    new_columns = {}
    for col in df.columns:
        if col not in column_mapping.values():  # Don't re-normalize already mapped columns
            normalized = re.sub(r'[^a-z0-9_]', '', col.lower().replace(" ", "_"))
            new_columns[col] = normalized
    
    df = df.rename(columns=new_columns)
    return df

def get_unique_filter(record):
    """Generate a unique filter for MongoDB upsert operations."""
    # Priority order for unique identifiers - updated for new schema
    unique_fields = ['email', 'mobile_number']  # Updated field names
    
    for field in unique_fields:
        if field in record and record[field] and str(record[field]).strip():
            return {field: record[field]}
    
    # If no unique field found, use name + position combination
    if 'full_name' in record and 'applied_position' in record:
        if record['full_name'] and record['applied_position']:
            return {'full_name': record['full_name'], 'applied_position': record['applied_position']}
    
    # Fallback to name + mobile if available
    if 'full_name' in record and 'mobile_number' in record:
        if record['full_name'] and record['mobile_number']:
            return {'full_name': record['full_name'], 'mobile_number': record['mobile_number']}
    
    return None

# ======================
# MAIN
# ======================

def main():
    """Main function to sync data from Google Sheets to MongoDB."""
    print("🚀 Starting Google Sheets to MongoDB sync...")
    print(f"📅 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Validate configuration
    if not validate_config():
        return False
    
    try:
        # Google Sheets connection
        print("\n🔐 Connecting to Google Sheets...")
        
        creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, SCOPE)
        client = gspread.authorize(creds)
        
        # Open spreadsheet by name
        print(f"📊 Opening spreadsheet: '{SPREADSHEET_NAME}'...")
        spreadsheet = client.open(SPREADSHEET_NAME)
        
        # List available worksheets
        worksheets = spreadsheet.worksheets()
        worksheet_names = [ws.title for ws in worksheets]
        print(f"📋 Available worksheets: {worksheet_names}")
        
        # Try to find the correct worksheet
        if WORKSHEET_NAME in worksheet_names:
            sheet = spreadsheet.worksheet(WORKSHEET_NAME)
        elif worksheet_names:
            # Use the first available worksheet
            sheet = worksheets[0]
            print(f"⚠️  '{WORKSHEET_NAME}' not found, using '{sheet.title}' instead")
        else:
            raise Exception("No worksheets found in the spreadsheet!")
            
        print(f"✅ Successfully connected to worksheet: '{sheet.title}'")
        
        # Get data
        print("📥 Fetching data from Google Sheets...")
        data = sheet.get_all_records()
        df = pd.DataFrame(data)
        
        if df.empty:
            print("⚠️  No data found in the spreadsheet.")
            return True
        
        # Normalize columns
        df = normalize_columns(df)
        print(f"📋 Retrieved {len(df)} rows from Sheets")
        print(f"📊 Columns found: {list(df.columns)}")
        
        # Check for required columns
        required_cols = ['full_name', 'email', 'applied_position'] 
        available_required = [col for col in required_cols if col in df.columns]
        missing_required = [col for col in required_cols if col not in df.columns]
        
        if missing_required:
            print(f"⚠️  Missing required columns: {missing_required}")
        else:
            print(f"✅ All required columns present: {available_required}")
        
        return sync_to_mongodb(df)
        
    except APIError as api_error:
        print(f"❌ Google API Error: {api_error}")
        if "API has not been used" in str(api_error) or "disabled" in str(api_error):
            print("""
🔧 SOLUTION: Enable required Google APIs:
1. Go to: https://console.cloud.google.com/
2. Enable Google Drive API and Google Sheets API
3. Wait a few minutes and retry
            """)
        elif "PERMISSION_DENIED" in str(api_error):
            print("""
🔧 SOLUTION: Permission denied:
1. Share your Google Sheet with the service account email
2. Grant at least 'Viewer' permissions
            """)
        return False
        
    except SpreadsheetNotFound:
        print(f"❌ Spreadsheet not found!")
        print("🔧 Check the spreadsheet name/ID and ensure your service account has access")
        return False
        
    except Exception as e:
        print(f"❌ Unexpected error connecting to Google Sheets: {e}")
        logging.exception("Google Sheets connection error")
        return False

def sync_to_mongodb(df):
    """Sync DataFrame data to MongoDB."""
    try:
        # MongoDB connection
        print("\n🗄  Connecting to MongoDB...")
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        
        # Test connection
        mongo_client.admin.command('ping')
        print("✅ Successfully connected to MongoDB")
        
        collection = mongo_client[DB_NAME][COLLECTION_NAME]
        print(f"📂 Using database: {DB_NAME}, collection: {COLLECTION_NAME}")
        
        # Prepare operations
        operations = []
        skipped_records = 0
        
        for idx, row in df.iterrows():
            record = row.to_dict()
            
            # Clean up empty values
            record = {k: v for k, v in record.items() if v is not None and str(v).strip() != ''}
            
            # Add metadata
            record['_synced_at'] = datetime.now()
            record['_source'] = 'google_sheets'
            record['_schema_version'] = '2.0'  # New schema version
            
            # Ensure required fields have defaults if missing
            if 'interview_status' not in record:
                record['interview_status'] = 'New'
            if 'availability' not in record:
                record['availability'] = 'Unknown'
            
            # Add unique ID for the record
            if 'unique_id' not in record:
                from ml_prediction_service import lead_scoring_service
                record['unique_id'] = lead_scoring_service.generate_unique_id(record)
            
            # Get unique filter
            unique_filter = get_unique_filter(record)
            
            if unique_filter:
                operations.append(
                    UpdateOne(
                        unique_filter,
                        {"$set": record},
                        upsert=True
                    )
                )
            else:
                skipped_records += 1
                print(f"⚠️  Skipped row {idx + 1}: No unique identifier found")
        
        # Execute operations
        if operations:
            print(f"\n💾 Syncing {len(operations)} records to MongoDB...")
            result = collection.bulk_write(operations)
            
            print(f"✅ MongoDB sync complete!")
            print(f"   📝 Inserted: {result.upserted_count}")
            print(f"   🔄 Updated: {result.modified_count}")
            print(f"   ⏭️  Skipped: {skipped_records}")
            
            # Log summary
            logging.info(f"Sync completed: {result.upserted_count} inserted, {result.modified_count} updated, {skipped_records} skipped")
            
            # Trigger ML predictions for new records
            try:
                if result.upserted_count > 0:
                    print(f"🤖 Triggering ML predictions for {result.upserted_count} new leads...")
                    from ml_prediction_service import lead_scoring_service
                    processed = lead_scoring_service.batch_predict_leads(limit=result.upserted_count)
                    print(f"✅ ML predictions completed for {len(processed)} leads")
            except Exception as ml_error:
                print(f"⚠️  ML prediction error: {ml_error}")
                logging.warning(f"ML prediction failed: {ml_error}")
            
        else:
            print("⚠️  No valid records to sync")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ MongoDB error: {e}")
        logging.exception("MongoDB sync error")
        
        if "authentication" in str(e).lower():
            print("🔧 Check your MongoDB credentials in the connection string")
        elif "timeout" in str(e).lower():
            print("🔧 Check your internet connection and MongoDB server availability")
        elif "network" in str(e).lower():
            print("🔧 Check your network connection to MongoDB")
            
        return False
    finally:
        try:
            mongo_client.close()
        except:
            pass

if __name__ == "__main__":
    success = main()
    if success:
        print("\n🎉 Sheets → MongoDB sync completed successfully!")
    else:
        print("\n❌ Sync failed. Check the errors above.")
        exit(1)
