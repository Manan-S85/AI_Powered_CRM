from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd


ENGAGEMENT_MULTIPLIER = {
    "low": 0.85,
    "medium": 1.0,
    "high": 1.15,
    "very_high": 1.3,
}

ENGAGEMENT_TIMING_FACTOR = {
    "low": 1.25,
    "medium": 1.0,
    "high": 0.82,
    "very_high": 0.68,
}

INDUSTRY_VALUE_MULTIPLIER = {
    "saas": 1.18,
    "technology": 1.1,
    "finance": 1.08,
    "healthcare": 1.06,
    "ecommerce": 1.05,
    "manufacturing": 1.02,
    "retail": 1.0,
    "education": 0.97,
    "other": 1.0,
}

INDUSTRY_TIMING_FACTOR = {
    "saas": 0.9,
    "technology": 0.94,
    "finance": 1.06,
    "healthcare": 1.02,
    "ecommerce": 0.93,
    "manufacturing": 1.1,
    "retail": 0.98,
    "education": 1.04,
    "other": 1.0,
}


@dataclass
class PurchaseBehavior:
    recency_days: int
    orders_last_12_months: int
    avg_order_value: float
    unique_products_purchased: int
    customer_lifetime_days: int
    avg_days_between_orders: float
    items_per_order: float
    total_spend_last_12_months: Optional[float] = None


@dataclass
class ClvPredictionInput:
    customer_id: str
    industry_type: str
    engagement_level: str
    purchase_behavior: PurchaseBehavior


class ClientLifetimeValuePredictor:
    """Production predictor with optional ML model loading and deterministic fallback."""

    def __init__(self) -> None:
        self.model = None
        self.model_path = self._resolve_model_path()
        self._load_model_if_available()

    @staticmethod
    def _resolve_model_path() -> Path:
        service_dir = Path(__file__).resolve().parent
        return service_dir.parent / "client lifetime value prediction" / "data" / "saved_model" / "clv_model_tuned.pkl"

    def _load_model_if_available(self) -> None:
        if not self.model_path.exists():
            self.model = None
            return

        try:
            self.model = joblib.load(self.model_path)
        except Exception:
            self.model = None

    @staticmethod
    def _safe_industry(industry_type: str) -> str:
        normalized = str(industry_type or "other").strip().lower()
        return normalized if normalized in INDUSTRY_VALUE_MULTIPLIER else "other"

    @staticmethod
    def _safe_engagement(engagement_level: str) -> str:
        normalized = str(engagement_level or "medium").strip().lower()
        return normalized if normalized in ENGAGEMENT_MULTIPLIER else "medium"

    @staticmethod
    def _build_feature_frame(purchase: PurchaseBehavior) -> pd.DataFrame:
        frequency = max(0, int(purchase.orders_last_12_months))
        unique_products = max(1, int(purchase.unique_products_purchased))
        lifetime_days = max(30, int(purchase.customer_lifetime_days))

        expansion_velocity = unique_products / (lifetime_days + 1)
        purchase_frequency_rate = frequency / (lifetime_days + 1)

        row = {
            "Recency": max(0, int(purchase.recency_days)),
            "Frequency": frequency,
            "Unique_Products": unique_products,
            "Customer_Lifetime_Days": lifetime_days,
            "Expansion_Velocity": float(expansion_velocity),
            "Purchase_Consistency": max(0.0, float(purchase.avg_days_between_orders)),
            "Items_Per_Order": max(0.0, float(purchase.items_per_order)),
            "Purchase_Frequency_Rate": float(purchase_frequency_rate),
            "Log_Frequency": float(np.log1p(frequency)),
            "Log_Unique_Products": float(np.log1p(unique_products)),
        }

        return pd.DataFrame([row])

    def _predict_base_clv(self, purchase: PurchaseBehavior) -> Tuple[float, str]:
        features = self._build_feature_frame(purchase)

        if self.model is not None:
            try:
                predicted_log = self.model.predict(features)[0]
                return float(np.expm1(predicted_log)), "ml_model"
            except Exception:
                pass

        annual_spend = (
            float(purchase.total_spend_last_12_months)
            if purchase.total_spend_last_12_months is not None
            else float(purchase.orders_last_12_months) * float(purchase.avg_order_value)
        )

        lifetime_years = max(0.08, float(purchase.customer_lifetime_days) / 365.0)
        recency_factor = 1.0 if purchase.recency_days <= 30 else max(0.65, 1.2 - (purchase.recency_days / 365.0))
        retention_factor = min(2.6, 0.9 + (0.45 * lifetime_years))

        base_clv = max(0.0, annual_spend * recency_factor * retention_factor)
        return float(base_clv), "rule_based"

    @staticmethod
    def _upsell_band(clv_value: float) -> str:
        if clv_value < 2000:
            return "Low"
        if clv_value < 7000:
            return "Medium"
        if clv_value < 15000:
            return "High"
        return "Very High"

    @staticmethod
    def _timing_window(days: int) -> str:
        if days <= 14:
            return "1-2 weeks"
        if days <= 30:
            return "2-4 weeks"
        if days <= 60:
            return "1-2 months"
        if days <= 90:
            return "2-3 months"
        return "3+ months"

    def predict(self, payload: ClvPredictionInput) -> Dict[str, Any]:
        industry = self._safe_industry(payload.industry_type)
        engagement = self._safe_engagement(payload.engagement_level)

        base_clv, model_used = self._predict_base_clv(payload.purchase_behavior)
        adjusted_clv = (
            base_clv
            * INDUSTRY_VALUE_MULTIPLIER[industry]
            * ENGAGEMENT_MULTIPLIER[engagement]
        )

        upsell_opportunity = self._upsell_band(adjusted_clv)

        cadence = max(7.0, float(payload.purchase_behavior.avg_days_between_orders or 30.0))
        velocity = max(0.001, float(payload.purchase_behavior.unique_products_purchased) / max(30.0, float(payload.purchase_behavior.customer_lifetime_days)))

        timing_days = cadence * ENGAGEMENT_TIMING_FACTOR[engagement] * INDUSTRY_TIMING_FACTOR[industry]
        timing_days *= (0.9 if upsell_opportunity in {"High", "Very High"} else 1.1)
        timing_days *= (1.0 / (1.0 + min(velocity, 1.0) * 0.3))

        recommended_days = int(round(min(180, max(7, timing_days))))

        completeness_points = 0
        completeness_points += 1 if payload.purchase_behavior.orders_last_12_months > 0 else 0
        completeness_points += 1 if payload.purchase_behavior.avg_order_value > 0 else 0
        completeness_points += 1 if payload.purchase_behavior.unique_products_purchased > 0 else 0
        completeness_points += 1 if payload.purchase_behavior.customer_lifetime_days > 0 else 0
        completeness_points += 1 if payload.purchase_behavior.avg_days_between_orders > 0 else 0
        confidence = round(min(0.95, 0.55 + (completeness_points * 0.08)), 2)

        key_signals: List[str] = [
            f"Industry multiplier applied: {INDUSTRY_VALUE_MULTIPLIER[industry]:.2f}x",
            f"Engagement multiplier applied: {ENGAGEMENT_MULTIPLIER[engagement]:.2f}x",
            f"Purchase cadence considered: {cadence:.1f} days",
            f"Model mode: {'ML model' if model_used == 'ml_model' else 'Rule-based fallback'}",
        ]

        return {
            "customer_id": payload.customer_id,
            "predicted_clv": round(float(adjusted_clv), 2),
            "upsell_opportunity": upsell_opportunity,
            "cross_sell_timing": {
                "recommended_in_days": recommended_days,
                "window": self._timing_window(recommended_days),
            },
            "confidence": confidence,
            "model_used": model_used,
            "signals": {
                "industry_type": industry,
                "engagement_level": engagement,
            },
            "explanation": key_signals,
        }


predictor = ClientLifetimeValuePredictor()
