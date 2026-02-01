"""
Google Sheets Service for FastAPI
Handles fetching data from Google Sheets connected to Google Forms
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
import logging
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

class GoogleSheetsService:
    def __init__(self):
        self.credentials_file = os.getenv('GOOGLE_SERVICE_ACCOUNT_KEY_FILE')
        self.spreadsheet_id = os.getenv('GOOGLE_SHEETS_ID')
        self.range_name = os.getenv('GOOGLE_SHEETS_RANGE', 'Sheet1!A:Z')
        self.service = None
        
    async def initialize(self):
        """Initialize Google Sheets API service"""
        try:
            if not self.credentials_file or not os.path.exists(self.credentials_file):
                logger.warning("Google service account file not found")
                return False
                
            credentials = Credentials.from_service_account_file(
                self.credentials_file,
                scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
            )
            
            self.service = build('sheets', 'v4', credentials=credentials)
            logger.info("Google Sheets API initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error initializing Google Sheets API: {e}")
            return False

    async def fetch_leads_from_sheet(self) -> List[Dict[str, Any]]:
        """
        Fetch lead data from Google Sheets
        Google Forms automatically saves responses here
        """
        try:
            if not self.service:
                initialized = await self.initialize()
                if not initialized:
                    return []

            # Call the Sheets API
            sheet = self.service.spreadsheets()
            result = sheet.values().get(
                spreadsheetId=self.spreadsheet_id,
                range=self.range_name
            ).execute()
            
            values = result.get('values', [])
            
            if not values:
                logger.info("No data found in Google Sheet")
                return []

            # First row contains headers from Google Forms
            headers = values[0]
            leads = []

            # Process each response row
            for i, row in enumerate(values[1:], 1):
                try:
                    lead_data = self._map_google_form_to_lead(headers, row)
                    if lead_data:
                        lead_data['sheet_row'] = i + 1  # Track row number
                        leads.append(lead_data)
                except Exception as e:
                    logger.error(f"Error processing row {i}: {e}")

            logger.info(f"Fetched {len(leads)} leads from Google Sheets")
            return leads

        except Exception as e:
            logger.error(f"Error fetching data from Google Sheets: {e}")
            return []

    def _map_google_form_to_lead(self, headers: List[str], row: List[str]) -> Optional[Dict[str, Any]]:
        """
        Map Google Form response to lead data structure
        """
        try:
            lead_data = {}
            
            # Common Google Forms field mappings
            field_mapping = {
                'timestamp': 'timestamp',
                'email': 'email',
                'email address': 'email', 
                'first name': 'firstName',
                'last name': 'lastName',
                'name': 'fullName',
                'phone': 'phone',
                'phone number': 'phone',
                'company': 'company',
                'company name': 'company',
                'organization': 'company',
                'job title': 'jobTitle',
                'position': 'jobTitle',
                'message': 'message',
                'inquiry': 'message',
                'description': 'description',
                'requirements': 'requirements',
                'budget': 'budget',
                'timeline': 'timeline',
                'urgency': 'urgency',
                'priority': 'urgency',
                'source': 'source',
                'how did you hear about us': 'source'
            }

            # Map form fields to lead structure
            for i, header in enumerate(headers):
                if i >= len(row):
                    continue
                    
                header_lower = header.lower().strip()
                value = row[i].strip() if row[i] else ""
                
                if not value:
                    continue

                # Map to lead field
                if header_lower in field_mapping:
                    lead_field = field_mapping[header_lower]
                    lead_data[lead_field] = value

            # Validate required fields
            if not lead_data.get('email'):
                logger.warning(f"Skipping row without email: {row}")
                return None

            # Set default values and process data
            lead_data['source'] = lead_data.get('source', 'google_forms')
            lead_data['status'] = 'new'
            
            # Parse timestamp if available
            if lead_data.get('timestamp'):
                lead_data['submittedAt'] = lead_data['timestamp']
            
            # Split full name if needed
            if lead_data.get('fullName') and not (lead_data.get('firstName') or lead_data.get('lastName')):
                name_parts = lead_data['fullName'].split(' ', 1)
                lead_data['firstName'] = name_parts[0]
                lead_data['lastName'] = name_parts[1] if len(name_parts) > 1 else ''

            # Process fields for ML features
            lead_data['has_budget'] = self._parse_budget_response(lead_data.get('budget', ''))
            lead_data['has_timeline'] = self._parse_timeline_response(lead_data.get('timeline', ''))
            lead_data['urgency_level'] = self._parse_urgency_response(lead_data.get('urgency', ''))

            return lead_data

        except Exception as e:
            logger.error(f"Error mapping Google Form data: {e}")
            return None

    def _parse_budget_response(self, budget_response: str) -> bool:
        """Parse budget response from Google Form"""
        if not budget_response:
            return False
            
        budget_lower = budget_response.lower()
        positive_indicators = ['yes', 'have budget', 'allocated', 'approved', '$', 'budget available']
        
        return any(indicator in budget_lower for indicator in positive_indicators)

    def _parse_timeline_response(self, timeline_response: str) -> bool:
        """Parse timeline response from Google Form"""
        if not timeline_response:
            return False
            
        timeline_lower = timeline_response.lower()
        immediate_indicators = ['asap', 'immediate', 'urgent', 'this week', 'this month', 'soon', '1 month']
        
        return any(indicator in timeline_lower for indicator in immediate_indicators)

    def _parse_urgency_response(self, urgency_response: str) -> int:
        """Parse urgency response from Google Form (1=low, 2=medium, 3=high)"""
        if not urgency_response:
            return 2
            
        urgency_lower = urgency_response.lower()
        
        if any(word in urgency_lower for word in ['high', 'urgent', 'critical', 'asap']):
            return 3
        elif any(word in urgency_lower for word in ['low', 'not urgent', 'flexible', 'no rush']):
            return 1
        else:
            return 2