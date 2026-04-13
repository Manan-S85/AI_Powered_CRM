import os
import uuid
import threading
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import logging
from typing import Dict, List, Optional
import json
from prediction_enhancer import PredictionEnhancer

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
        self.prediction_enhancer = None
        
        self._initialize_components()
    
    def _initialize_components(self):
        """Initialize MongoDB connection and ML model."""
        try:
            # MongoDB connection
            mongo_uri = os.getenv('MONGODB_URI')
            db_name = os.getenv('DB_NAME', 'ai_crm_db')
            
            if mongo_uri:
                candidate_client = None
                # Test connection with timeout - retry 3 times
                for attempt in range(3):
                    try:
                        # Keep min pool at 0 to avoid noisy background maintenance when network is unstable.
                        candidate_client = MongoClient(
                            mongo_uri,
                            serverSelectionTimeoutMS=5000,
                            connectTimeoutMS=5000,
                            socketTimeoutMS=10000,
                            maxPoolSize=10,
                            minPoolSize=0,
                            retryWrites=True,
                            retryReads=True,
                            directConnection=False,
                        )
                        candidate_client.admin.command('ping', maxTimeMS=5000)
                        self.mongo_client = candidate_client
                        self.collection = self.mongo_client[db_name]['leads']
                        logging.info(f"[OK] ML Service connected to MongoDB (attempt {attempt+1})")
                        break
                    except Exception as conn_err:
                        if candidate_client is not None:
                            try:
                                candidate_client.close()
                            except Exception:
                                pass
                            candidate_client = None

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

                # Initialize non-breaking enhancement layer.
                try:
                    model_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'ml_model'))
                    self.prediction_enhancer = PredictionEnhancer(
                        model=self.temperature_model,
                        model_metadata=self.model_metadata,
                        model_root=model_root,
                    )
                    logging.info("✅ Prediction enhancement layer initialized")
                except Exception as enhancer_error:
                    self.prediction_enhancer = None
                    logging.warning(f"[WARN] Prediction enhancement layer disabled: {enhancer_error}")
            
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
            
            # Keep class mapping tied to the actual trained model output order.
            model_classes = [str(item) for item in getattr(self.temperature_model, 'classes_', [])]
            if len(model_classes) != len(probabilities):
                model_classes = ['Cold', 'Hot', 'Warm']

            prob_dict = {model_classes[i]: float(probabilities[i]) for i in range(len(probabilities))}
            raw_confidence = float(max(probabilities)) if len(probabilities) > 0 else 0.0
            base_prediction = str(prediction)

            enhanced = None
            if self.prediction_enhancer is not None:
                try:
                    enhanced = self.prediction_enhancer.refine_prediction(
                        record=record,
                        feature_values=feature_values,
                        base_prediction=base_prediction,
                        raw_probabilities=prob_dict,
                    )
                except Exception as enhancer_error:
                    logging.warning(f"[WARN] Prediction enhancement failed; using base output: {enhancer_error}")

            if enhanced is None:
                confidence = raw_confidence
                final_label = base_prediction
                final_probabilities = prob_dict
                confidence_level = 'High' if confidence >= 0.82 else ('Medium' if confidence >= 0.65 else 'Low')
                confidence_threshold = float(os.getenv('LEAD_CONFIDENCE_THRESHOLD', '0.70'))
                label_reason = 'Base model output used'
                calibration_applied = False
                calibrated_probabilities = prob_dict
                is_uncertain = bool(confidence < confidence_threshold)
                uncertainty = {
                    'is_uncertain': is_uncertain,
                    'summary': (
                        f'Uncertainty flag raised for {final_label} classification'
                        if is_uncertain
                        else f'Confidence is stable for {final_label} classification'
                    ),
                    'reasons': (
                        [
                            (
                                f'Model confidence is below the accepted production threshold '
                                f'({confidence:.1%} vs {confidence_threshold:.0%}).'
                            ),
                            'Fallback path used without calibration metadata from enhancement layer.',
                        ]
                        if is_uncertain
                        else []
                    ),
                    'recommended_action': (
                        'Collect additional lead context before prioritization.'
                        if is_uncertain
                        else 'No additional clarification required.'
                    ),
                    'confidence_threshold': confidence_threshold,
                    'top_label': final_label,
                    'top_score': confidence,
                }
                rule_engine = {
                    'enabled': False,
                    'business_signal': 0.0,
                    'applied_rules': [],
                }
            else:
                confidence = float(enhanced.get('confidence', raw_confidence))
                final_label = str(enhanced.get('final_label', base_prediction))
                final_probabilities = enhanced.get('probabilities', prob_dict)
                confidence_level = str(enhanced.get('confidence_level', 'Low'))
                confidence_threshold = float(enhanced.get('confidence_threshold', 0.70))
                label_reason = str(enhanced.get('label_reason', 'Enhanced prediction output'))
                calibration_applied = bool(enhanced.get('calibration_applied', False))
                calibrated_probabilities = enhanced.get('calibrated_probabilities', prob_dict)
                is_uncertain = bool(enhanced.get('is_uncertain', False))
                uncertainty = enhanced.get('uncertainty', {
                    'is_uncertain': is_uncertain,
                    'summary': str(enhanced.get('uncertainty_reason', label_reason)),
                    'reasons': [],
                    'recommended_action': 'Collect additional lead context before prioritization.' if is_uncertain else 'No additional clarification required.',
                    'confidence_threshold': confidence_threshold,
                    'top_label': final_label,
                    'top_score': confidence,
                })
                rule_engine = enhanced.get('rule_engine', {
                    'enabled': False,
                    'business_signal': 0.0,
                    'applied_rules': [],
                })

            return {
                # Backward-compatible keys
                'predicted_temperature': final_label,
                'confidence': confidence,
                'probabilities': final_probabilities,
                'model_version': self.model_metadata.get('training_date', 'unknown'),
                'prediction_timestamp': datetime.now().isoformat(),

                # Enhanced, interpretable output
                'final_label': final_label,
                'confidence_level': confidence_level,
                'confidence_threshold': confidence_threshold,
                'label_reason': label_reason,
                'base_model_temperature': base_prediction,
                'raw_confidence': raw_confidence,
                'raw_probabilities': prob_dict,
                'calibration_applied': calibration_applied,
                'calibrated_probabilities': calibrated_probabilities,
                'rule_engine': rule_engine,
                'is_uncertain': is_uncertain,
                'uncertainty_reason': str(uncertainty.get('summary', label_reason)),
                'uncertainty': uncertainty,
            }
            
        except Exception as e:
            logging.error(f"Error predicting temperature: {e}")
            return {'error': str(e)}

    def _schedule_uncertain_prediction_fallback(self, unique_id: str, lead_record: Dict, ml_prediction: Dict) -> None:
        """Run optional low-confidence fallback evaluation asynchronously."""
        if self.prediction_enhancer is None:
            return

        if not self.prediction_enhancer.should_schedule_fallback(ml_prediction):
            return

        def _worker() -> None:
            try:
                fallback_result = self.prediction_enhancer.run_fallback_evaluation(lead_record, ml_prediction)

                if self.collection is not None:
                    self.collection.update_one(
                        {'unique_id': unique_id},
                        {'$set': {'ml_prediction.llm_fallback': fallback_result}}
                    )
            except Exception as worker_error:
                logging.warning(f"[WARN] Async low-confidence fallback failed: {worker_error}")

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
    
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

            if self.prediction_enhancer is not None and self.prediction_enhancer.should_schedule_fallback(ml_prediction):
                enhanced_record['ml_prediction']['llm_fallback'] = {
                    'status': 'scheduled',
                    'scheduled_at': datetime.now().isoformat(),
                }
            
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

            # Non-blocking optional reassessment for low-confidence predictions.
            self._schedule_uncertain_prediction_fallback(unique_id, record, ml_prediction)
            
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

    def _normalize_prediction_for_response(self, prediction: Dict) -> Dict:
        """Return API-safe prediction with deterministic Hot/Warm/Cold classification."""
        if not isinstance(prediction, dict):
            return prediction

        current_label = str(prediction.get('predicted_temperature') or '').strip()
        if current_label != 'Uncertain':
            return prediction

        fallback_label = (
            prediction.get('base_model_temperature')
            or (prediction.get('uncertainty') or {}).get('top_label')
            or prediction.get('final_label')
            or 'Cold'
        )

        normalized = dict(prediction)
        normalized['predicted_temperature'] = fallback_label
        normalized['final_label'] = fallback_label
        normalized['is_uncertain'] = True

        uncertainty = normalized.get('uncertainty')
        if not isinstance(uncertainty, dict):
            uncertainty = {}

        summary = str(
            uncertainty.get('summary')
            or normalized.get('uncertainty_reason')
            or f'Uncertainty flag raised for {fallback_label} classification'
        )

        normalized['uncertainty_reason'] = summary
        normalized['uncertainty'] = {
            **uncertainty,
            'is_uncertain': True,
            'top_label': uncertainty.get('top_label') or fallback_label,
            'summary': summary,
        }

        return normalized

    def _canonicalize_key(self, key: str) -> str:
        """Return a comparable key for schema alias matching."""
        return ''.join(ch for ch in str(key or '').lower() if ch.isalnum())

    def _build_field_index(self, lead: Dict) -> Dict[str, object]:
        """Index lead keys in canonical form for robust alias lookup."""
        index = {}
        for raw_key, value in (lead or {}).items():
            index[self._canonicalize_key(raw_key)] = value
        return index

    def _pick_alias_value(self, index: Dict[str, object], *aliases, default=None):
        """Pick first non-empty value from a list of alias keys."""
        for alias in aliases:
            value = index.get(self._canonicalize_key(alias))
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            return value
        return default

    def _to_int(self, value, default: int = 0) -> int:
        """Best-effort conversion for numeric display fields."""
        if value is None:
            return default

        try:
            if isinstance(value, bool):
                return int(value)
            if isinstance(value, (int, float)):
                return int(value)

            value_str = str(value)
            digits = ''.join(ch for ch in value_str if ch.isdigit() or ch == '.')
            if not digits:
                return default
            return int(float(digits))
        except Exception:
            return default

    def _normalize_lead_for_response(self, lead: Dict) -> Dict:
        """Normalize lead payload before returning it through APIs."""
        if not isinstance(lead, dict):
            return lead

        normalized = dict(lead)
        index = self._build_field_index(normalized)

        first_name = self._pick_alias_value(index, 'first_name', 'firstName', default='')
        last_name = self._pick_alias_value(index, 'last_name', 'lastName', default='')
        full_name = f"{str(first_name or '').strip()} {str(last_name or '').strip()}".strip()

        normalized['name'] = self._pick_alias_value(
            index,
            'name',
            'full_name',
            'full name',
            'candidate_name',
            default=full_name or 'N/A'
        )
        normalized['email'] = self._pick_alias_value(index, 'email', 'email_address', 'email address', default='N/A')
        normalized['phone'] = self._pick_alias_value(index, 'phone', 'mobile_number', 'mobile', default='N/A')
        normalized['role_position'] = self._pick_alias_value(
            index,
            'role_position',
            'applied_position',
            'position',
            'job_role',
            'job role',
            default='N/A'
        )
        normalized['years_of_experience'] = self._to_int(
            self._pick_alias_value(index, 'years_of_experience', 'years of experience', 'experience', 'exp', default=0),
            default=0,
        )
        normalized['location'] = self._pick_alias_value(
            index,
            'location',
            'current_location',
            'current location',
            'city',
            default='N/A'
        )
        normalized['expected_salary'] = self._to_int(
            self._pick_alias_value(index, 'expected_salary', 'expected salary', 'salary', 'annual_salary', default=0),
            default=0,
        )
        normalized['skills'] = self._pick_alias_value(index, 'skills', 'primary_skills', 'primary skills', default='N/A')
        normalized['highest_education'] = self._pick_alias_value(index, 'highest_education', 'highest education')
        normalized['linkedin_profile'] = self._pick_alias_value(index, 'linkedin_profile', 'linkedin profile')
        normalized['willing_to_relocate'] = self._pick_alias_value(index, 'willing_to_relocate', 'willing to relocate')
        normalized['company_name'] = self._pick_alias_value(index, 'company_name', 'company name', default='')
        normalized['company_website'] = self._pick_alias_value(index, 'company_website', 'company website', default='')
        normalized['company_email'] = self._pick_alias_value(index, 'company_email', 'company email', default='')

        normalized['ml_prediction'] = self._normalize_prediction_for_response(normalized.get('ml_prediction'))
        return normalized

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
            leads = [self._normalize_lead_for_response(lead) for lead in leads]
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
            return self._normalize_lead_for_response(lead) if lead else None
            
        except Exception as e:
            logging.error(f"Error getting lead {unique_id}: {e}")
            return None
    
    def get_leads_by_temperature(self, temperature: str, limit: int = 20) -> List[Dict]:
        """Get leads filtered by predicted temperature."""
        try:
            if self.collection is None:
                return []

            # Include legacy records that were stored as 'Uncertain' and normalize before filtering.
            cursor = self.collection.find({'ml_prediction': {'$exists': True}}).limit(max(limit * 5, 100))
            leads = [self._normalize_lead_for_response(lead) for lead in list(cursor)]
            filtered = [
                lead for lead in leads
                if str((lead.get('ml_prediction') or {}).get('predicted_temperature')) == temperature
            ]
            return filtered[:limit]
            
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