from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .predictor import ClvPredictionInput, PurchaseBehavior, predictor

router = APIRouter(prefix="/clv", tags=["Client Lifetime Value"])


class PurchaseBehaviorRequest(BaseModel):
    recency_days: int = Field(ge=0, le=3650)
    orders_last_12_months: int = Field(ge=0, le=10000)
    avg_order_value: float = Field(gt=0, le=100000000)
    unique_products_purchased: int = Field(ge=1, le=100000)
    customer_lifetime_days: int = Field(ge=30, le=36500)
    avg_days_between_orders: float = Field(ge=0, le=3650)
    items_per_order: float = Field(gt=0, le=100000)
    total_spend_last_12_months: Optional[float] = Field(default=None, ge=0, le=1000000000)


class ClvPredictionRequest(BaseModel):
    customer_id: str = Field(min_length=1, max_length=120)
    industry_type: Literal[
        "saas",
        "technology",
        "finance",
        "healthcare",
        "ecommerce",
        "manufacturing",
        "retail",
        "education",
        "other",
    ]
    engagement_level: Literal["low", "medium", "high", "very_high"]
    purchase_behavior: PurchaseBehaviorRequest


class CrossSellTimingResponse(BaseModel):
    recommended_in_days: int
    window: str


class ClvPredictionResponse(BaseModel):
    success: bool
    customer_id: str
    predicted_clv: float
    upsell_opportunity: str
    cross_sell_timing: CrossSellTimingResponse
    confidence: float
    model_used: str
    signals: Dict[str, str]
    explanation: List[str]


@router.post("/predict", response_model=ClvPredictionResponse, summary="Predict Client Lifetime Value")
async def predict_client_ltv(payload: ClvPredictionRequest):
    """
    Predict CLV with upsell opportunity and cross-sell timing from purchase behavior,
    industry type, and engagement level.
    """
    try:
        normalized = ClvPredictionInput(
            customer_id=payload.customer_id,
            industry_type=payload.industry_type,
            engagement_level=payload.engagement_level,
            purchase_behavior=PurchaseBehavior(**payload.purchase_behavior.model_dump()),
        )

        result = predictor.predict(normalized)
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to predict CLV: {error}")
