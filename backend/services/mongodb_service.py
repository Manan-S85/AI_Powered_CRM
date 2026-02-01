"""
MongoDB Service for FastAPI
Handles all database operations for the CRM pipeline
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

logger = logging.getLogger(__name__)

class MongoDBService:
    def __init__(self):
        self.mongodb_url = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/ai_crm_db')
        self.db_name = os.getenv('DB_NAME', 'ai_crm_db')
        self.client = None
        self.db = None
        self.leads_collection = None

    async def connect(self):
        """Initialize MongoDB connection"""
        try:
            self.client = AsyncIOMotorClient(self.mongodb_url)
            self.db = self.client[self.db_name]
            self.leads_collection = self.db.leads
            
            # Test connection
            await self.client.admin.command('ping')
            logger.info("MongoDB connection established successfully")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to MongoDB: {e}")
            return False

    async def store_lead(self, lead_data: Dict[str, Any]) -> str:
        """
        Store lead data from Google Sheets into MongoDB
        Returns the inserted document ID
        """
        try:
            if not self.leads_collection:
                await self.connect()

            # Check if lead already exists (by email)
            existing_lead = await self.leads_collection.find_one(
                {"email": lead_data.get("email")}
            )

            if existing_lead:
                # Update existing lead with new data from Google Sheets
                update_data = {
                    **lead_data,
                    "updatedAt": datetime.utcnow(),
                    "googleSheetsSync": {
                        "lastSynced": datetime.utcnow(),
                        "source": "google_forms",
                        "rowNumber": lead_data.get("sheet_row")
                    }
                }
                
                await self.leads_collection.update_one(
                    {"_id": existing_lead["_id"]},
                    {"$set": update_data}
                )
                
                logger.info(f"Updated existing lead: {lead_data.get('email')}")
                return str(existing_lead["_id"])
            else:
                # Create new lead
                new_lead = {
                    **lead_data,
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow(),
                    "status": "new",
                    "googleSheetsSync": {
                        "lastSynced": datetime.utcnow(),
                        "source": "google_forms",
                        "rowNumber": lead_data.get("sheet_row")
                    },
                    # ML fields - initially empty, filled by ML processing
                    "mlPrediction": None,
                    "leadScore": None,
                    "processedAt": None
                }
                
                result = await self.leads_collection.insert_one(new_lead)
                logger.info(f"Stored new lead: {lead_data.get('email')}")
                return str(result.inserted_id)

        except Exception as e:
            logger.error(f"Error storing lead in MongoDB: {e}")
            raise

    async def get_unprocessed_leads(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get leads that haven't been processed by ML yet
        """
        try:
            if not self.leads_collection:
                await self.connect()

            cursor = self.leads_collection.find({
                "$or": [
                    {"mlPrediction": {"$exists": False}},
                    {"mlPrediction": None},
                    {"leadScore": {"$exists": False}},
                    {"leadScore": None}
                ]
            }).limit(limit)

            leads = []
            async for lead in cursor:
                lead["_id"] = str(lead["_id"])  # Convert ObjectId to string
                leads.append(lead)

            logger.info(f"Found {len(leads)} unprocessed leads")
            return leads

        except Exception as e:
            logger.error(f"Error fetching unprocessed leads: {e}")
            return []

    async def update_lead_with_ml_results(
        self, 
        lead_id: str, 
        prediction: str, 
        lead_score: int, 
        ml_features: Dict[str, Any]
    ):
        """
        Update lead with ML prediction results and save back to MongoDB
        """
        try:
            if not self.leads_collection:
                await self.connect()

            # Convert string ID back to ObjectId
            object_id = ObjectId(lead_id)
            
            update_data = {
                "mlPrediction": {
                    "lead_type": prediction,
                    "predictedAt": datetime.utcnow(),
                    "features": ml_features
                },
                "leadScore": lead_score,
                "processedAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            }

            result = await self.leads_collection.update_one(
                {"_id": object_id},
                {"$set": update_data}
            )

            if result.modified_count > 0:
                logger.info(f"Updated lead {lead_id} with ML results: {prediction}, score: {lead_score}")
            else:
                logger.warning(f"No lead found with ID {lead_id}")

        except Exception as e:
            logger.error(f"Error updating lead with ML results: {e}")
            raise

    async def get_leads_for_frontend(self, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get processed leads for Frontend Dashboard
        Returns leads with ML scores and predictions
        """
        try:
            if not self.leads_collection:
                await self.connect()

            cursor = self.leads_collection.find({}).sort([
                ("leadScore", -1),  # Highest scores first
                ("createdAt", -1)   # Newest first
            ]).skip(skip).limit(limit)

            leads = []
            async for lead in cursor:
                # Convert ObjectId to string for JSON serialization
                lead["_id"] = str(lead["_id"])
                
                # Ensure dates are properly formatted
                for date_field in ["createdAt", "updatedAt", "processedAt"]:
                    if lead.get(date_field):
                        lead[date_field] = lead[date_field].isoformat()

                leads.append(lead)

            logger.info(f"Retrieved {len(leads)} leads for frontend")
            return leads

        except Exception as e:
            logger.error(f"Error fetching leads for frontend: {e}")
            return []

    async def get_pipeline_statistics(self) -> Dict[str, Any]:
        """
        Get pipeline statistics for status monitoring
        """
        try:
            if not self.leads_collection:
                await self.connect()

            total_leads = await self.leads_collection.count_documents({})
            
            google_forms_leads = await self.leads_collection.count_documents({
                "source": "google_forms"
            })
            
            processed_leads = await self.leads_collection.count_documents({
                "mlPrediction": {"$exists": True, "$ne": None}
            })
            
            scored_leads = await self.leads_collection.count_documents({
                "leadScore": {"$exists": True, "$ne": None}
            })

            # Recent activity (last 24 hours)
            yesterday = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            recent_leads = await self.leads_collection.count_documents({
                "createdAt": {"$gte": yesterday}
            })

            # Lead type distribution
            pipeline = [
                {"$match": {"mlPrediction.lead_type": {"$exists": True}}},
                {"$group": {"_id": "$mlPrediction.lead_type", "count": {"$sum": 1}}}
            ]
            
            lead_types = {}
            async for doc in self.leads_collection.aggregate(pipeline):
                lead_types[doc["_id"]] = doc["count"]

            return {
                "total_leads": total_leads,
                "google_forms_leads": google_forms_leads,
                "processed_leads": processed_leads,
                "scored_leads": scored_leads,
                "recent_leads_24h": recent_leads,
                "processing_rate": f"{(processed_leads/total_leads*100):.1f}%" if total_leads > 0 else "0%",
                "lead_type_distribution": lead_types
            }

        except Exception as e:
            logger.error(f"Error getting pipeline statistics: {e}")
            return {}