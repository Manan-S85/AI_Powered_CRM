from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .ai_recommender import generate_recommendation
from .data_processor import FollowupDataError, process_data
from .pattern_analyzer import analyze_patterns

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/followup", tags=["Follow-up Optimization"])


class FollowupInteraction(BaseModel):
    sent_time: datetime
    reply_time: Optional[datetime] = None
    channel: str = Field(min_length=1, max_length=100)


class FollowupOptimizationRequest(BaseModel):
    lead_id: str = Field(min_length=1, max_length=100)
    interactions: List[FollowupInteraction] = Field(min_length=1)


class FollowupOptimizationResponse(BaseModel):
    lead_id: str
    best_day: str
    best_time: str
    best_channel: str
    confidence: str
    model: str
    reason: str


@router.post("/optimize", response_model=FollowupOptimizationResponse, summary="Optimize Follow-up Timing")
async def optimize_followup(request: FollowupOptimizationRequest):
    """
    Analyze historical interactions and suggest the best follow-up day/time/channel.
    """
    try:
        payload = [item.model_dump() for item in request.interactions]
        df = process_data(payload)
        insights = analyze_patterns(df)
        recommendation = generate_recommendation(request.lead_id, insights)

        return recommendation
    except FollowupDataError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        logger.error("Follow-up optimization failed: %s", error, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to optimize follow-up strategy")
