import os
import uuid
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import logging
from typing import Dict, List, Optional
import json

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class LeadScoringService:
    """Service for ML-based lead scoring and temperature prediction."""
    
    def __init__(self):
        self.mongo_client = None
        self.collection = None
        self.temperature_model = None
        self.model_metadata = None
        self.feature_mapper = None
        
        self._initialize_components()
    
    def _initialize_components(self):
        """Initialize MongoDB connection and ML model."""
        try:
            # MongoDB connection
            mongo_uri = os.getenv('MONGODB_URI')
            db_name = os.getenv('DB_NAME', 'ai_crm_db')
            
            if mongo_uri:
                # Add timeout to prevent hangs - balanced timeouts for reliability
                self.mongo_client = MongoClient(
                    mongo_uri,
                    serverSelectionTimeoutMS=5000,  # 5 second timeout for better reliability
                    connectTimeoutMS=5000,
                    socketTimeoutMS=10000,  # 10 seconds for queries
                    maxPoolSize=10,
                    minPoolSize=1,
                    retryWrites=True,
                    retryReads=True
                )
                # Test connection with timeout - retry 3 times
                for attempt in range(3):
                    try:
                        self.mongo_client.admin.command('ping', maxTimeMS=5000)
                        self.collection = self.mongo_client[db_name]['leads']
                        logging.info(f"[OK] ML Service connected to MongoDB (attempt {attempt+1})")
                        break
                    except Exception as conn_err:
                        if attempt == 2:  # Last attempt
                            logging.error(f"[ERROR] ML Service MongoDB connection failed: {conn_err}")
                            self.mongo_client = None
                            self.collection = None
                        else:
                            logging.warning(f"[RETRY] ML Service MongoDB connection attempt {attempt+1} failed, retrying...")
            
            # Load the trained temperature model
            model_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ml_model', 'models', 'lead_temperature_model.pkl')
            metadata_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ml_model', 'models', 'temperature_model_metadata.json')
            
            if os.path.exists(model_path):
                self.temperature_model = joblib.load(model_path)
                logging.info("✅ Loaded trained temperature model")
                
                # Load model metadata
                with open(metadata_path, 'r') as f:
                    self.model_metadata = json.load(f)
                logging.info(f"✅ Model accuracy: {self.model_metadata['performance']['accuracy']:.1%}")
            
        except Exception as e:
            logging.error(f"❌ Error initializing components: {e}")
    
    def generate_unique_id(self, record: Dict) -> str:
        """Generate a unique ID for a lead record."""
        # Create a base from email or name+phone
        base_data = ""
        
        if record.get('email'):
            base_data = record['email'].lower().strip()
        elif record.get('full_name') and record.get('mobile_number'):  # Updated field names
            base_data = f"{record['full_name'].lower().strip()}_{record.get('mobile_number', '').strip()}"
        else:
            # Fallback to random UUID
            return str(uuid.uuid4())
        
        # Create a deterministic UUID based on the data
        # This ensures same person always gets same ID
        namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # Standard namespace
        unique_id = str(uuid.uuid5(namespace, base_data))
        
        return unique_id
    
    def map_new_schema_to_model_features(self, record: Dict) -> Dict:
        """Map new schema fields to what the trained model expects."""
        try:
            def pick(*keys, default=None):
                for key in keys:
                    value = record.get(key)
                    if value is not None and str(value).strip() != "":
                        return value
                return default

            # Get the features the model expects
            expected_features = self.model_metadata['feature_columns']
            
            # Create feature mapping from new schema to old schema
            feature_values = {}
            
            # Direct mappings where possible
            mappings = {
                'Lead Origin': 'Landing Page Submission',  # Default assumption
                'Lead Source': pick('linkedin_profile', default='Direct Traffic'),  # Infer from LinkedIn
                'Do Not Email': 'No',  # Default
                'Do Not Call': 'No',   # Default
                'TotalVisits': 1,  # Default for new leads
                'Total Time Spent on Website': 300,  # Default 5 minutes
                'Page Views Per Visit': 2.0,  # Default
                'Last Activity': 'Form Submitted',  # Default for new leads
                'Country': 'India',  # Default
                'Specialization': pick('primary_skills', 'skills', default='Select'),
                'How did you hear about X Education': 'Select',
                'What is your current occupation': self._infer_occupation(record),
                'What matters most to you in choosing a course': 'Better Career Prospects',
                'Search': 'No',
                'Magazine': 'No',
                'Newspaper Article': 'No',
                'X Education Forums': 'No',
                'Newspaper': 'No',
                'Digital Advertisement': 'No',
                'Through Recommendations': 'No',
                'Receive More Updates About Our Courses': 'No',
                'Tags': 'Interested in other courses',
                'Lead Quality': self._infer_lead_quality(record),
                'Update me on Supply Chain Content': 'No',
                'Get updates on DM Content': 'No',
                'Lead Profile': 'Potential Lead',
                'City': pick('current_location', 'location', default='Mumbai'),
                'Asymmetrique Activity Index': '02.Medium',
                'Asymmetrique Profile Index': '02.Medium',
                'Asymmetrique Activity Score': 15.0,
                'Asymmetrique Profile Score': 15.0,
                'I agree to pay the amount through cheque': 'No',
                'A free copy of Mastering The Interview': 'No',
                'Last Notable Activity': 'Form Submitted',
                'Highest education': pick('highest_education', default=self._infer_education(record)),
                'Years of experience': self._process_numeric_field(pick('years_of_experience', 'experience', default='0')),
                'Primary skills': pick('primary_skills', 'skills', default='Unknown'),
                'Current location': pick('current_location', 'location', default='Unknown'),
                'Expected salary': self._process_salary(pick('expected_salary', 'salary', default='0')),
                'Willing to relocate': pick('willing_to_relocate', 'relocate', default='No'),
                'Sent to backend': 'Yes'
            }
            
            # Fill in all expected features
            for feature in expected_features:
                if feature in mappings:
                    feature_values[feature] = mappings[feature]
                else:
                    # Default values for missing features
                    feature_values[feature] = self._get_default_value(feature)
            
            return feature_values
            
        except Exception as e:
            logging.error(f"Error mapping features: {e}")
            return {}
    
    def _infer_occupation(self, record: Dict) -> str:
        """Infer occupation from applied position."""
        role = str(
            record.get('applied_position')
            or record.get('role_position')
            or record.get('position')
            or ''
        ).lower()
        if 'engineer' in role or 'developer' in role:
            return 'Working Professional'
        elif 'manager' in role or 'lead' in role:
            return 'Working Professional'
        elif 'student' in role or 'fresher' in role:
            return 'Student'
        else:
            return 'Working Professional'
    
    def _infer_lead_quality(self, record: Dict) -> str:
        """Infer lead quality based on available information."""
        score = 0
        
        # Check completeness
        if record.get('email'): score += 1
        if record.get('mobile_number') or record.get('phone'): score += 1
        if record.get('linkedin_profile'): score += 2
        if record.get('highest_education'): score += 2
        if record.get('primary_skills') or record.get('skills'): score += 1
        
        # Handle years_of_experience as string
        experience_str = str(record.get('years_of_experience', '0'))
        try:
            experience = int(float(experience_str)) if experience_str.replace('.', '').isdigit() else 0
            if experience > 0: score += 1
        except (ValueError, TypeError):
            pass
        
        if score >= 5:
            return 'High in Relevance'
        elif score >= 3:
            return 'Medium'
        else:
            return 'Low in Relevance'
    
    def _infer_education(self, record: Dict) -> str:
        """Infer education level from role/experience."""
        explicit_education = record.get('highest_education')
        if explicit_education and str(explicit_education).strip():
            return str(explicit_education)

        # Handle years_of_experience as string or number
        experience_str = str(record.get('years_of_experience', '0'))
        try:
            experience = int(float(experience_str)) if experience_str.replace('.', '').isdigit() else 0
        except (ValueError, TypeError):
            experience = 0
            
        role = str(
            record.get('applied_position')
            or record.get('role_position')
            or record.get('position')
            or ''
        ).lower()
        
        if 'senior' in role or experience >= 8:
            return 'Master\'s Degree'
        elif experience >= 3:
            return 'Bachelor\'s Degree'
        else:
            return 'Bachelor\'s Degree'
    
    def _process_numeric_field(self, value) -> float:
        """Process numeric fields that might come as strings."""
        if not value:
            return 0.0
        
        # Convert to string and clean
        value_str = str(value).strip()
        
        # Remove common non-numeric characters
        import re
        numeric_str = re.sub(r'[^0-9.]', '', value_str)
        
        try:
            return float(numeric_str) if numeric_str else 0.0
        except ValueError:
            return 0.0
    
    def _process_salary(self, value) -> float:
        """Process salary field which might be in formats like '8 LPA', '500000', etc."""
        if not value:
            return 0.0
        
        # Convert to string and clean
        value_str = str(value).upper().strip()
        
        # Handle LPA (Lakhs Per Annum) format
        if 'LPA' in value_str:
            import re
            numbers = re.findall(r'\d+(?:\.\d+)?', value_str)
            if numbers:
                return float(numbers[0]) * 100000  # Convert LPA to actual amount
        
        # Handle regular numeric values
        import re
        numeric_str = re.sub(r'[^0-9.]', '', value_str)
        
        try:
            return float(numeric_str) if numeric_str else 0.0
        except ValueError:
            return 0.0
    
    def _get_default_value(self, feature: str) -> str:
        """Get default value for a feature."""
        numeric_features = ['TotalVisits', 'Total Time Spent on Website', 'Page Views Per Visit', 
                          'Asymmetrique Activity Score', 'Asymmetrique Profile Score', 
                          'Years of experience', 'Expected salary']
        
        if feature in numeric_features:
            return 0 if 'salary' in feature.lower() else 1
        else:
            return 'Select'
    
    def predict_lead_temperature(self, record: Dict) -> Dict:
        """Predict lead temperature using the trained model."""
        try:
            if not self.temperature_model:
                return {'error': 'Model not loaded'}
            
            # Map new schema to model features
            feature_values = self.map_new_schema_to_model_features(record)
            
            if not feature_values:
                return {'error': 'Could not map features'}
            
            # Create DataFrame with the features
            df = pd.DataFrame([feature_values])
            
            # Make prediction
            prediction = self.temperature_model.predict(df)[0]
            probabilities = self.temperature_model.predict_proba(df)[0]
            
            # Get probability for each class
            classes = ['Cold', 'Hot', 'Warm']  # Alphabetical order
            prob_dict = {classes[i]: float(probabilities[i]) for i in range(len(classes))}
            
            confidence = max(probabilities)
            
            return {
                'predicted_temperature': prediction,
                'confidence': float(confidence),
                'probabilities': prob_dict,
                'model_version': self.model_metadata.get('training_date', 'unknown'),
                'prediction_timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logging.error(f"Error predicting temperature: {e}")
            return {'error': str(e)}
    
    def process_lead_with_ml(self, record: Dict) -> Dict:
        """Process a lead record with ML predictions and unique ID."""
        try:
            # Generate unique ID
            unique_id = self.generate_unique_id(record)
            
            # Make ML prediction
            ml_prediction = self.predict_lead_temperature(record)
            
            # Enhanced record
            enhanced_record = record.copy()
            enhanced_record.update({
                'unique_id': unique_id,
                'ml_prediction': ml_prediction,
                'processed_at': datetime.now(),
                'ml_enabled': True
            })
            
            # Save to MongoDB if collection is available
            if self.collection is not None:
                try:
                    # Check if lead already exists
                    existing_lead = self.collection.find_one({'unique_id': unique_id})
                    
                    if existing_lead:
                        # Update existing lead
                        self.collection.update_one(
                            {'unique_id': unique_id},
                            {'$set': enhanced_record}
                        )
                        logging.info(f"✅ Updated lead: {unique_id}")
                    else:
                        # Insert new lead
                        self.collection.insert_one(enhanced_record)
                        logging.info(f"✅ Saved new lead to MongoDB: {unique_id}")
                except Exception as db_error:
                    logging.warning(f"⚠️ Could not save to MongoDB: {db_error}")
                    # Continue anyway - we still have the prediction result
            
            return enhanced_record
            
        except Exception as e:
            logging.error(f"Error processing lead: {e}")
            return record
    
    def batch_predict_leads(self, limit: int = 50) -> List[Dict]:
        """Batch process leads from MongoDB with ML predictions."""
        try:
            if self.collection is None:
                return []
            
            # Find leads without ML predictions
            query = {'ml_prediction': {'$exists': False}}
            leads = list(self.collection.find(query).limit(limit))
            
            logging.info(f"🔍 Found {len(leads)} leads to process")
            
            processed_leads = []
            
            for lead in leads:
                # Process with ML
                enhanced_lead = self.process_lead_with_ml(lead)
                
                # Update in database
                self.collection.update_one(
                    {'_id': lead['_id']},
                    {'$set': {
                        'unique_id': enhanced_lead['unique_id'],
                        'ml_prediction': enhanced_lead['ml_prediction'],
                        'processed_at': enhanced_lead['processed_at'],
                        'ml_enabled': enhanced_lead['ml_enabled']
                    }}
                )
                
                processed_leads.append(enhanced_lead)
            
            logging.info(f"✅ Processed {len(processed_leads)} leads with ML predictions")
            return processed_leads
            
        except Exception as e:
            logging.error(f"Error in batch prediction: {e}")
            return []
    
    def get_lead_with_prediction(self, unique_id: str) -> Optional[Dict]:
        """Get a specific lead with its ML prediction."""
        try:
            if self.collection is None:
                return None
            
            lead = self.collection.find_one({'unique_id': unique_id})
            return lead
            
        except Exception as e:
            logging.error(f"Error fetching lead: {e}")
            return None
    
    def get_leads_by_temperature(self, temperature: str, limit: int = 20) -> List[Dict]:
        """Get leads filtered by predicted temperature."""
        try:
            if self.collection is None:
                return []
            
            query = {'ml_prediction.predicted_temperature': temperature}
            leads = list(self.collection.find(query).limit(limit))
            
            return leads
            
        except Exception as e:
            logging.error(f"Error fetching leads by temperature: {e}")
            return []
    
    def get_prediction_stats(self) -> Dict:
        """Get statistics about ML predictions."""
        try:
            if self.collection is None:
                return {}
            
            pipeline = [
                {'$match': {'ml_prediction': {'$exists': True}}},
                {'$group': {
                    '_id': '$ml_prediction.predicted_temperature',
                    'count': {'$sum': 1},
                    'avg_confidence': {'$avg': '$ml_prediction.confidence'}
                }}
            ]
            
            stats = list(self.collection.aggregate(pipeline))
            
            total_predictions = self.collection.count_documents({'ml_prediction': {'$exists': True}})
            total_leads = self.collection.count_documents({})
            
            return {
                'total_leads': total_leads,
                'total_predictions': total_predictions,
                'coverage_percentage': (total_predictions / total_leads * 100) if total_leads > 0 else 0,
                'temperature_distribution': stats,
                'last_updated': datetime.now().isoformat()
            }
            
        except Exception as e:
            logging.error(f"Error getting stats: {e}")
            return {}

    def get_all_leads_with_predictions(self, limit: int = 50) -> List[Dict]:
        """Get all leads with their ML predictions from MongoDB."""
        try:
            if self.collection is None:
                logging.warning("[WARN] No MongoDB collection available for leads")
                # Try to reinitialize connection
                self._initialize_components()
                if self.collection is None:
                    return []
            
            cursor = self.collection.find({}).limit(limit).sort("_id", -1)
            leads = list(cursor)
            logging.info(f"[OK] Fetched {len(leads)} leads from MongoDB")
            
            return leads
            
        except Exception as e:
            logging.error(f"[ERROR] Failed to fetch leads: {e}")
            # Try to reinitialize connection for next attempt
            try:
                self._initialize_components()
            except:
                pass
            return []
    
    def get_lead_with_prediction(self, unique_id: str) -> Optional[Dict]:
        """Get a specific lead with its ML prediction."""
        try:
            if self.collection is None:
                return None
            
            lead = self.collection.find_one({"unique_id": unique_id})
            return lead
            
        except Exception as e:
            logging.error(f"Error getting lead {unique_id}: {e}")
            return None
    
    def get_leads_by_temperature(self, temperature: str, limit: int = 20) -> List[Dict]:
        """Get leads filtered by predicted temperature."""
        try:
            if self.collection is None:
                return []
            
            query = {"ml_prediction.predicted_temperature": temperature}
            cursor = self.collection.find(query).limit(limit)
            leads = list(cursor)
            
            return leads
            
        except Exception as e:
            logging.error(f"Error getting leads by temperature {temperature}: {e}")
            return []

# Global instance - lazy initialization to prevent startup hangs
_lead_scoring_service = None

def get_lead_scoring_service():
    """
    Get the lead scoring service instance with lazy initialization.
    This prevents MongoDB connection issues from blocking imports.
    """
    global _lead_scoring_service
    if _lead_scoring_service is None:
        try:
            _lead_scoring_service = LeadScoringService()
            logging.info("✅ Lead scoring service initialized successfully")
        except Exception as e:
            logging.error(f"❌ Failed to initialize lead scoring service: {e}")
            # Return a mock service that always returns errors
            _lead_scoring_service = MockLeadScoringService()
    return _lead_scoring_service

class MockLeadScoringService:
    """Mock service for when initialization fails."""
    
    def __init__(self):
        self.temperature_model = None
        self.model_metadata = {'error': 'Service initialization failed'}
        
    def process_lead_with_ml(self, lead_data):
        return {
            'unique_id': 'error',
            'ml_prediction': {
                'error': 'ML service not available - check MongoDB connection and model files'
            }
        }
    
    def get_all_leads_with_predictions(self, limit=50):
        return []
    
    def get_leads_by_temperature(self, temperature, limit=20):
        return []
    
    def get_prediction_stats(self):
        return {
            'total_leads': 0,
            'total_predictions': 0,
            'coverage_percentage': 0.0,
            'temperature_distribution': []
        }

# For backwards compatibility - create a simple lazy-loaded variable
class LazyLeadScoringService:
    """Wrapper for lazy-loaded service."""
    def __init__(self):
        self._service = None
    
    def __getattr__(self, name):
        if self._service is None:
            self._service = get_lead_scoring_service()
        return getattr(self._service, name)

# Create module-level instance
lead_scoring_service = LazyLeadScoringService()

def main():
    """Demo function to test the ML prediction service."""
    print("🚀 Lead Scoring Service - ML Prediction Demo")
    print("=" * 60)
    
    # Test with sample data
    sample_lead = {
        'name': 'John Doe',
        'email': 'john.doe@example.com',
        'phone': '+1-555-0123',
        'role_position': 'Senior Software Engineer',
        'skills': 'Python, Machine Learning, AWS',
        'linkedin_profile': 'linkedin.com/in/johndoe',
        'years_of_experience': 5,
        'expected_salary': 120000,
        'location': 'San Francisco',
        'availability': 'Immediately',
        'interview_status': 'New'
    }
    
    # Process the lead
    result = lead_scoring_service.process_lead_with_ml(sample_lead)
    
    print(f"📊 Sample Lead Processing Results:")
    print(f"   • Unique ID: {result.get('unique_id')}")
    print(f"   • Predicted Temperature: {result['ml_prediction'].get('predicted_temperature')}")
    print(f"   • Confidence: {result['ml_prediction'].get('confidence', 0):.1%}")
    
    # Show probabilities
    probs = result['ml_prediction'].get('probabilities', {})
    print(f"   • Probabilities:")
    for temp, prob in probs.items():
        print(f"     - {temp}: {prob:.1%}")
    
    # Batch process
    print(f"\\n🔄 Running batch prediction on MongoDB leads...")
    processed = lead_scoring_service.batch_predict_leads(limit=10)
    print(f"✅ Processed {len(processed)} leads from database")
    
    # Get stats
    stats = lead_scoring_service.get_prediction_stats()
    if stats:
        print(f"\\n📈 Prediction Statistics:")
        print(f"   • Total Leads: {stats['total_leads']}")
        print(f"   • ML Coverage: {stats['coverage_percentage']:.1f}%")

if __name__ == "__main__":
    main()