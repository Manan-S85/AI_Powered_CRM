"""
ML Service for FastAPI
Handles feature extraction and ML model integration
Works with existing ML models without modifying them
"""

import logging
from typing import Dict, Any
from predictor import classify_lead

logger = logging.getLogger(__name__)

class MLService:
    def __init__(self):
        self.score_mapping = {
            'hot': 90,
            'warm': 70, 
            'qualified': 85,
            'cold': 30,
            'unqualified': 20
        }

    def extract_features(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract ML features from lead data for model input
        """
        try:
            # Get message content (from various possible fields)
            message = (
                lead_data.get('message', '') or 
                lead_data.get('description', '') or 
                lead_data.get('requirements', '') or
                ''
            )

            # Extract boolean features
            has_budget = bool(lead_data.get('has_budget', False))
            has_timeline = bool(lead_data.get('has_timeline', False))
            
            # Extract urgency level (1-3)
            urgency = int(lead_data.get('urgency_level', 2))
            
            # Additional features for scoring
            features = {
                'message': message,
                'has_budget': has_budget,
                'has_timeline': has_timeline,
                'urgency': urgency,
                'message_length': len(message),
                'company': lead_data.get('company', ''),
                'job_title': lead_data.get('jobTitle', ''),
                'source': lead_data.get('source', ''),
                'email_domain': lead_data.get('email', '').split('@')[-1] if lead_data.get('email') else ''
            }

            logger.debug(f"Extracted ML features: {features}")
            return features

        except Exception as e:
            logger.error(f"Error extracting ML features: {e}")
            return {
                'message': '',
                'has_budget': False,
                'has_timeline': False,
                'urgency': 2
            }

    def get_ml_prediction(self, features: Dict[str, Any]) -> str:
        """
        Get prediction from existing ML model
        Uses the classify_lead function from predictor.py
        """
        try:
            prediction = classify_lead(
                features.get('message', ''),
                features.get('has_budget', False),
                features.get('has_timeline', False),
                features.get('urgency', 2)
            )
            
            logger.info(f"ML prediction: {prediction}")
            return prediction
            
        except Exception as e:
            logger.error(f"Error getting ML prediction: {e}")
            return 'unknown'

    def calculate_score(self, prediction: str, features: Dict[str, Any]) -> int:
        """
        Convert ML prediction to numerical lead score (0-100)
        Includes additional scoring factors
        """
        try:
            # Base score from ML prediction
            base_score = self.score_mapping.get(prediction, 50)
            
            # Additional scoring factors
            bonus_points = 0
            
            # Company email domain bonus
            email_domain = features.get('email_domain', '').lower()
            if email_domain and not email_domain in ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com']:
                bonus_points += 5  # Business email bonus
            
            # Message quality bonus
            message_length = features.get('message_length', 0)
            if message_length > 50:
                bonus_points += 5  # Detailed inquiry bonus
            elif message_length > 20:
                bonus_points += 3
                
            # Job title bonus
            job_title = features.get('job_title', '').lower()
            decision_maker_titles = ['ceo', 'cto', 'founder', 'director', 'manager', 'head', 'vp']
            if any(title in job_title for title in decision_maker_titles):
                bonus_points += 10  # Decision maker bonus

            # Company name bonus
            if features.get('company') and len(features.get('company', '')) > 0:
                bonus_points += 5
                
            # Budget and timeline combination bonus
            if features.get('has_budget') and features.get('has_timeline'):
                bonus_points += 10  # Ready to buy bonus
                
            # High urgency bonus
            if features.get('urgency', 2) >= 3:
                bonus_points += 5

            # Calculate final score
            final_score = min(100, base_score + bonus_points)
            
            logger.info(f"Lead score calculated: {final_score} (base: {base_score}, bonus: {bonus_points})")
            return final_score

        except Exception as e:
            logger.error(f"Error calculating lead score: {e}")
            return 50  # Default score on error

    def get_score_explanation(self, prediction: str, features: Dict[str, Any], final_score: int) -> Dict[str, Any]:
        """
        Provide explanation for the lead score
        """
        try:
            base_score = self.score_mapping.get(prediction, 50)
            
            factors = []
            factors.append({
                'factor': 'ML Prediction',
                'value': prediction,
                'points': base_score,
                'description': f'ML model classified this lead as "{prediction}"'
            })

            # Add factor explanations
            if features.get('has_budget') and features.get('has_timeline'):
                factors.append({
                    'factor': 'Budget & Timeline',
                    'value': 'Both Available',
                    'points': 10,
                    'description': 'Lead has both budget and immediate timeline'
                })
                
            email_domain = features.get('email_domain', '').lower()
            if email_domain and not email_domain in ['gmail.com', 'yahoo.com', 'hotmail.com']:
                factors.append({
                    'factor': 'Business Email',
                    'value': email_domain,
                    'points': 5,
                    'description': 'Using business email domain'
                })

            return {
                'final_score': final_score,
                'prediction': prediction,
                'factors': factors,
                'calculated_at': logger.info
            }

        except Exception as e:
            logger.error(f"Error generating score explanation: {e}")
            return {'final_score': final_score, 'prediction': prediction, 'factors': []}