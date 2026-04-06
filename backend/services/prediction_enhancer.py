"""Enhancement layer for lead temperature predictions.

This module is designed to be additive and removable. It augments an existing
multi-class classifier with:
- probability calibration
- confidence thresholding
- lightweight rule-based refinement
- optional low-confidence LLM fallback evaluation
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
import requests
from sklearn.isotonic import IsotonicRegression

logger = logging.getLogger(__name__)


@dataclass
class EnhancementConfig:
    confidence_threshold: float
    high_confidence_threshold: float
    rule_adjustment_strength: float
    calibration_enabled: bool
    calibration_autofit: bool
    calibration_min_samples: int
    calibration_positive_min: int
    rule_engine_enabled: bool
    llm_fallback_enabled: bool
    llm_timeout_seconds: int

    @classmethod
    def from_env(cls) -> "EnhancementConfig":
        def _as_bool(name: str, default: str) -> bool:
            return str(os.getenv(name, default)).strip().lower() in {"1", "true", "yes", "on"}

        confidence_threshold = float(os.getenv("LEAD_CONFIDENCE_THRESHOLD", "0.70"))
        confidence_threshold = max(0.50, min(confidence_threshold, 0.95))

        high_conf = float(os.getenv("LEAD_HIGH_CONFIDENCE_THRESHOLD", "0.82"))
        high_conf = max(confidence_threshold, min(high_conf, 0.99))

        strength = float(os.getenv("LEAD_RULE_ADJUSTMENT_STRENGTH", "0.18"))
        strength = max(0.0, min(strength, 0.40))

        return cls(
            confidence_threshold=confidence_threshold,
            high_confidence_threshold=high_conf,
            rule_adjustment_strength=strength,
            calibration_enabled=_as_bool("LEAD_CONFIDENCE_CALIBRATION_ENABLED", "true"),
            calibration_autofit=_as_bool("LEAD_CONFIDENCE_CALIBRATION_AUTOFIT", "true"),
            calibration_min_samples=int(os.getenv("LEAD_CALIBRATION_MIN_SAMPLES", "500")),
            calibration_positive_min=int(os.getenv("LEAD_CALIBRATION_MIN_CLASS_SAMPLES", "25")),
            rule_engine_enabled=_as_bool("LEAD_RULE_ENGINE_ENABLED", "true"),
            llm_fallback_enabled=_as_bool("LEAD_ENABLE_LLM_FALLBACK", "false"),
            llm_timeout_seconds=int(os.getenv("LEAD_LLM_FALLBACK_TIMEOUT_SECONDS", "12")),
        )


class ProbabilityCalibrator:
    """Per-class isotonic calibration for multi-class probability vectors."""

    def __init__(self, model_root: Path, config: EnhancementConfig):
        self.model_root = model_root
        self.config = config
        self.calibrator_path = self.model_root / "models" / "temperature_probability_calibrator.pkl"
        self.class_calibrators: Dict[str, IsotonicRegression] = {}
        self.classes: List[str] = []
        self.fitted: bool = False

    def initialize(self, model: Any, metadata: Dict[str, Any]) -> None:
        if not self.config.calibration_enabled:
            return

        if self._load_existing():
            logger.info("[Enhancer] Loaded probability calibrator")
            return

        if not self.config.calibration_autofit:
            logger.info("[Enhancer] Calibration autofit disabled; using raw probabilities")
            return

        try:
            self._fit_and_persist(model=model, metadata=metadata)
        except Exception as error:
            logger.warning(f"[Enhancer] Calibration fit skipped: {error}")

    def calibrate(self, probabilities: Dict[str, float]) -> Tuple[Dict[str, float], bool]:
        if not self.fitted or not self.class_calibrators:
            return probabilities, False

        calibrated: Dict[str, float] = {}
        for class_name, raw_prob in probabilities.items():
            try:
                x = float(raw_prob)
            except (TypeError, ValueError):
                x = 0.0

            calibrator = self.class_calibrators.get(class_name)
            if calibrator is None:
                calibrated[class_name] = max(0.0, x)
                continue

            try:
                adjusted = float(calibrator.predict([x])[0])
                calibrated[class_name] = max(0.0, adjusted)
            except Exception:
                calibrated[class_name] = max(0.0, x)

        normalized = self._normalize_probabilities(calibrated, fallback=probabilities)
        return normalized, True

    def _load_existing(self) -> bool:
        if not self.calibrator_path.exists():
            return False

        payload = joblib.load(self.calibrator_path)
        classes = payload.get("classes")
        calibrators = payload.get("class_calibrators")

        if not isinstance(classes, list) or not isinstance(calibrators, dict):
            return False

        self.classes = [str(item) for item in classes]
        self.class_calibrators = {
            str(class_name): calibrator
            for class_name, calibrator in calibrators.items()
            if hasattr(calibrator, "predict")
        }
        self.fitted = len(self.class_calibrators) > 0
        return self.fitted

    def _fit_and_persist(self, model: Any, metadata: Dict[str, Any]) -> None:
        dataset = self._load_calibration_dataset(metadata)
        if dataset is None or dataset.empty:
            raise ValueError("No calibration dataset available")

        target_col = str(
            os.getenv("LEAD_CALIBRATION_TARGET_COLUMN", "").strip()
            or metadata.get("target_column")
            or "Lead Temperature"
        )
        feature_columns = metadata.get("feature_columns") or []

        if target_col not in dataset.columns:
            raise ValueError(f"Target column '{target_col}' not found in calibration dataset")

        missing_features = [col for col in feature_columns if col not in dataset.columns]
        if missing_features:
            raise ValueError(f"Calibration dataset missing features: {missing_features[:5]}")

        dataset = dataset.dropna(subset=[target_col])
        if len(dataset) < self.config.calibration_min_samples:
            raise ValueError(
                f"Calibration dataset has only {len(dataset)} rows; "
                f"requires at least {self.config.calibration_min_samples}"
            )

        x = dataset[feature_columns]
        y = dataset[target_col].astype(str)

        raw_proba = model.predict_proba(x)
        model_classes = [str(item) for item in getattr(model, "classes_", [])]
        if len(model_classes) != raw_proba.shape[1]:
            raise ValueError("Model classes do not align with predict_proba output")

        class_calibrators: Dict[str, IsotonicRegression] = {}
        for index, class_name in enumerate(model_classes):
            y_binary = (y == class_name).astype(int)
            positives = int(y_binary.sum())
            negatives = int(len(y_binary) - positives)

            if positives < self.config.calibration_positive_min or negatives < self.config.calibration_positive_min:
                logger.info(
                    f"[Enhancer] Skip calibrator for class '{class_name}' due to low support "
                    f"(pos={positives}, neg={negatives})"
                )
                continue

            calibrator = IsotonicRegression(out_of_bounds="clip")
            calibrator.fit(raw_proba[:, index], y_binary)
            class_calibrators[class_name] = calibrator

        if not class_calibrators:
            raise ValueError("Unable to fit any class calibrator")

        payload = {
            "classes": model_classes,
            "class_calibrators": class_calibrators,
            "fitted_at": pd.Timestamp.utcnow().isoformat(),
            "dataset_rows": int(len(dataset)),
        }

        self.calibrator_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(payload, self.calibrator_path)

        self.classes = model_classes
        self.class_calibrators = class_calibrators
        self.fitted = True
        logger.info(f"[Enhancer] Probability calibrator fitted and saved to {self.calibrator_path}")

    def _load_calibration_dataset(self, metadata: Dict[str, Any]) -> Optional[pd.DataFrame]:
        candidates: List[Path] = []
        configured = os.getenv("LEAD_CALIBRATION_DATASET_PATH", "").strip()
        if configured:
            candidates.append(Path(configured))

        candidates.extend(
            [
                self.model_root / "Enhanced_Leads.csv",
                self.model_root / "Leads.csv",
                self.model_root / "leads_dataset.csv",
            ]
        )

        for path in candidates:
            try:
                if path.exists():
                    dataset = pd.read_csv(path)
                    logger.info(f"[Enhancer] Loaded calibration dataset: {path} ({len(dataset)} rows)")
                    return dataset
            except Exception as error:
                logger.warning(f"[Enhancer] Could not load calibration dataset {path}: {error}")

        return None

    @staticmethod
    def _normalize_probabilities(probabilities: Dict[str, float], fallback: Dict[str, float]) -> Dict[str, float]:
        total = float(sum(max(0.0, value) for value in probabilities.values()))
        if total <= 0:
            return dict(fallback)

        normalized = {
            class_name: float(max(0.0, value) / total)
            for class_name, value in probabilities.items()
        }
        return normalized


class HybridRuleEngine:
    """Business-rule refinement that nudges but does not blindly override ML output."""

    def __init__(self, config: EnhancementConfig):
        self.config = config

    def apply(
        self,
        record: Dict[str, Any],
        feature_values: Dict[str, Any],
        probabilities: Dict[str, float],
    ) -> Tuple[Dict[str, float], Dict[str, Any]]:
        if not self.config.rule_engine_enabled:
            return probabilities, {
                "enabled": False,
                "business_signal": 0.0,
                "applied_rules": [],
            }

        adjusted = dict(probabilities)
        applied_rules: List[str] = []
        business_signal = 0.0

        salary = self._safe_float(record.get("expected_salary", feature_values.get("Expected salary", 0)))
        if salary >= 1200000:
            business_signal += 0.12
            applied_rules.append("high_expected_salary")
        elif salary >= 800000:
            business_signal += 0.07
            applied_rules.append("upper_mid_expected_salary")
        elif 0 < salary <= 300000:
            business_signal -= 0.06
            applied_rules.append("low_expected_salary")

        experience = self._safe_float(record.get("years_of_experience", feature_values.get("Years of experience", 0)))
        if experience >= 8:
            business_signal += 0.10
            applied_rules.append("senior_experience")
        elif experience >= 4:
            business_signal += 0.06
            applied_rules.append("mid_experience")
        elif 0 <= experience <= 1:
            business_signal -= 0.05
            applied_rules.append("entry_experience")

        lead_quality = str(feature_values.get("Lead Quality", "")).lower()
        if "high" in lead_quality:
            business_signal += 0.10
            applied_rules.append("high_lead_quality")
        elif "medium" in lead_quality:
            business_signal += 0.04
            applied_rules.append("medium_lead_quality")
        elif "low" in lead_quality:
            business_signal -= 0.08
            applied_rules.append("low_lead_quality")

        lead_source = str(feature_values.get("Lead Source", "")).lower()
        if "linkedin" in lead_source or "recommend" in lead_source:
            business_signal += 0.05
            applied_rules.append("high_intent_source")
        elif "direct" in lead_source:
            business_signal += 0.02
            applied_rules.append("direct_source")

        total_visits = self._safe_float(feature_values.get("TotalVisits", 0))
        time_spent = self._safe_float(feature_values.get("Total Time Spent on Website", 0))

        if total_visits > 3:
            business_signal += 0.04
            applied_rules.append("high_visit_count")
        elif total_visits <= 1:
            business_signal -= 0.03
            applied_rules.append("low_visit_count")

        if time_spent > 600:
            business_signal += 0.06
            applied_rules.append("high_site_engagement")
        elif 0 < time_spent < 120:
            business_signal -= 0.04
            applied_rules.append("low_site_engagement")

        business_signal = max(-0.35, min(0.35, business_signal))

        strength = self.config.rule_adjustment_strength
        if strength > 0:
            adjusted.setdefault("Hot", 0.0)
            adjusted.setdefault("Warm", 0.0)
            adjusted.setdefault("Cold", 0.0)

            if business_signal > 0:
                delta = strength * business_signal
                adjusted["Hot"] += delta
                adjusted["Cold"] -= delta * 0.8
                adjusted["Warm"] -= delta * 0.2
            elif business_signal < 0:
                delta = strength * abs(business_signal)
                adjusted["Cold"] += delta
                adjusted["Hot"] -= delta * 0.8
                adjusted["Warm"] -= delta * 0.2

            adjusted = self._normalize(adjusted)

        return adjusted, {
            "enabled": True,
            "business_signal": float(round(business_signal, 4)),
            "applied_rules": applied_rules,
        }

    @staticmethod
    def _safe_float(value: Any) -> float:
        try:
            cleaned = str(value).replace(",", "").strip()
            if not cleaned:
                return 0.0
            return float(cleaned)
        except Exception:
            return 0.0

    @staticmethod
    def _normalize(probabilities: Dict[str, float]) -> Dict[str, float]:
        clipped = {key: max(0.0001, float(value)) for key, value in probabilities.items()}
        total = sum(clipped.values())
        if total <= 0:
            return probabilities
        return {key: float(value / total) for key, value in clipped.items()}


class LowConfidenceFallbackEvaluator:
    """Optional external LLM reassessment for low-confidence predictions."""

    def __init__(self, config: EnhancementConfig):
        self.config = config

    def evaluate(self, record: Dict[str, Any], prediction: Dict[str, Any]) -> Dict[str, Any]:
        provider = self._resolve_provider()
        if provider is None:
            raise ValueError("No LLM provider key configured for fallback")

        prompt = self._build_prompt(record, prediction)

        if provider == "gemini":
            return self._call_gemini(prompt)
        return self._call_openai(prompt)

    def _resolve_provider(self) -> Optional[str]:
        preferred = str(os.getenv("LEAD_LLM_FALLBACK_PROVIDER", os.getenv("LLM_PROVIDER", ""))).strip().lower()
        has_gemini = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
        has_openai = bool(os.getenv("OPENAI_API_KEY"))

        if preferred == "gemini" and has_gemini:
            return "gemini"
        if preferred == "openai" and has_openai:
            return "openai"

        if has_gemini:
            return "gemini"
        if has_openai:
            return "openai"
        return None

    def _build_prompt(self, record: Dict[str, Any], prediction: Dict[str, Any]) -> str:
        return (
            "You are a lead qualification assistant.\n"
            "Given lead attributes and an uncertain ML prediction, provide a cautious reassessment.\n"
            "Return strict JSON with keys: suggested_label, rationale, action.\n"
            "suggested_label must be one of Hot, Warm, Cold, Uncertain.\n\n"
            f"Lead:\n{json.dumps(record, ensure_ascii=True)}\n\n"
            f"CurrentPrediction:\n{json.dumps(prediction, ensure_ascii=True)}\n"
        )

    def _call_openai(self, prompt: str) -> Dict[str, Any]:
        api_key = str(os.getenv("OPENAI_API_KEY", "")).strip()
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")

        model_name = str(os.getenv("LEAD_LLM_FALLBACK_OPENAI_MODEL", "gpt-4o-mini")).strip()
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model_name,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": "Return strict JSON only."},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=self.config.llm_timeout_seconds,
        )

        if response.status_code >= 400:
            raise ValueError(f"OpenAI fallback failed: {response.status_code} {response.text}")

        payload = response.json()
        text = payload.get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = self._parse_json(text)
        return self._sanitize_fallback_result(parsed)

    def _call_gemini(self, prompt: str) -> Dict[str, Any]:
        api_key = str(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY/GOOGLE_API_KEY not configured")

        model_name = str(os.getenv("LEAD_LLM_FALLBACK_GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))).strip()
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

        response = requests.post(
            endpoint,
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0,
                    "responseMimeType": "application/json",
                },
            },
            timeout=self.config.llm_timeout_seconds,
        )

        if response.status_code >= 400:
            raise ValueError(f"Gemini fallback failed: {response.status_code} {response.text}")

        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            raise ValueError("Gemini fallback returned no candidates")

        text = ""
        for part in candidates[0].get("content", {}).get("parts", []):
            if isinstance(part, dict) and part.get("text"):
                text += str(part["text"])

        parsed = self._parse_json(text)
        return self._sanitize_fallback_result(parsed)

    @staticmethod
    def _parse_json(text: str) -> Dict[str, Any]:
        cleaned = (text or "").strip()
        if not cleaned:
            raise ValueError("Fallback model returned empty content")

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start >= 0 and end > start:
                return json.loads(cleaned[start:end + 1])
            raise

    @staticmethod
    def _sanitize_fallback_result(payload: Dict[str, Any]) -> Dict[str, Any]:
        allowed_labels = {"Hot", "Warm", "Cold", "Uncertain"}

        label = str(payload.get("suggested_label", "Uncertain")).strip().title()
        if label not in allowed_labels:
            label = "Uncertain"

        rationale = str(payload.get("rationale", "")).strip() or "No rationale returned"
        action = str(payload.get("action", "")).strip() or "Collect more lead context"

        return {
            "suggested_label": label,
            "rationale": rationale,
            "action": action,
        }


class PredictionEnhancer:
    """Orchestrates calibration, thresholding, rules, and optional fallback."""

    def __init__(self, model: Any, model_metadata: Dict[str, Any], model_root: Path):
        self.model = model
        self.model_metadata = model_metadata or {}
        self.model_root = Path(model_root)

        self.config = EnhancementConfig.from_env()
        self.calibrator = ProbabilityCalibrator(self.model_root, self.config)
        self.rule_engine = HybridRuleEngine(self.config)
        self.fallback_evaluator = LowConfidenceFallbackEvaluator(self.config)

        self.calibrator.initialize(model=self.model, metadata=self.model_metadata)

    def refine_prediction(
        self,
        record: Dict[str, Any],
        feature_values: Dict[str, Any],
        base_prediction: str,
        raw_probabilities: Dict[str, float],
    ) -> Dict[str, Any]:
        calibrated_probabilities, calibration_applied = self.calibrator.calibrate(raw_probabilities)
        refined_probabilities, rule_info = self.rule_engine.apply(
            record=record,
            feature_values=feature_values,
            probabilities=calibrated_probabilities,
        )

        top_label, top_score = self._top_class(refined_probabilities)
        second_label, second_score = self._second_class(refined_probabilities)

        # Classification remains deterministic (Hot/Warm/Cold) while uncertainty is surfaced separately.
        final_label = top_label
        uncertainty = self._build_uncertainty_details(
            record=record,
            top_label=top_label,
            top_score=top_score,
            second_label=second_label,
            second_score=second_score,
        )

        if uncertainty["is_uncertain"]:
            label_reason = (
                f"Classified as {top_label} with uncertainty flag: "
                f"{uncertainty['summary']}"
            )
        else:
            label_reason = "Confidence above threshold after calibration and rule refinement"

        confidence_level = self._confidence_level(top_score)

        return {
            "final_label": final_label,
            "confidence": float(top_score),
            "confidence_level": confidence_level,
            "confidence_threshold": float(self.config.confidence_threshold),
            "label_reason": label_reason,
            "calibration_applied": bool(calibration_applied),
            "probabilities": refined_probabilities,
            "calibrated_probabilities": calibrated_probabilities,
            "rule_engine": rule_info,
            "base_prediction": str(base_prediction),
            "raw_probabilities": raw_probabilities,
            "raw_confidence": float(max(raw_probabilities.values()) if raw_probabilities else 0.0),
            "is_uncertain": bool(uncertainty["is_uncertain"]),
            "uncertainty": uncertainty,
            "uncertainty_reason": str(uncertainty["summary"]),
        }

    def should_schedule_fallback(self, prediction: Dict[str, Any]) -> bool:
        if not self.config.llm_fallback_enabled:
            return False

        if bool(prediction.get("is_uncertain")):
            return True

        uncertainty = prediction.get("uncertainty")
        if isinstance(uncertainty, dict) and bool(uncertainty.get("is_uncertain")):
            return True

        # Legacy fallback for older payloads.
        return str(prediction.get("final_label") or prediction.get("predicted_temperature")) == "Uncertain"

    def run_fallback_evaluation(self, record: Dict[str, Any], prediction: Dict[str, Any]) -> Dict[str, Any]:
        try:
            result = self.fallback_evaluator.evaluate(record=record, prediction=prediction)
            return {
                "status": "completed",
                "provider": self.fallback_evaluator._resolve_provider(),
                "suggested_label": result.get("suggested_label", "Uncertain"),
                "rationale": result.get("rationale", "No rationale returned"),
                "action": result.get("action", "Collect more lead context"),
                "evaluated_at": pd.Timestamp.utcnow().isoformat(),
            }
        except Exception as error:
            return {
                "status": "failed",
                "error": str(error),
                "evaluated_at": pd.Timestamp.utcnow().isoformat(),
            }

    def _confidence_level(self, confidence: float) -> str:
        if confidence >= self.config.high_confidence_threshold:
            return "High"
        if confidence >= self.config.confidence_threshold:
            return "Medium"
        return "Low"

    def _build_uncertainty_details(
        self,
        record: Dict[str, Any],
        top_label: str,
        top_score: float,
        second_label: str,
        second_score: float,
    ) -> Dict[str, Any]:
        reasons: List[str] = []

        if top_score < self.config.confidence_threshold:
            reasons.append(
                "Model confidence is below the accepted production threshold "
                f"({top_score:.1%} vs {self.config.confidence_threshold:.0%})."
            )

        margin = top_score - second_score
        if margin < 0.10:
            reasons.append(
                "Top class separation is narrow, indicating overlapping class probabilities."
            )

        missing_signals = self._collect_missing_signals(record)
        if missing_signals:
            reasons.append(
                "Lead profile is sparse in key decision signals: " + ", ".join(missing_signals) + "."
            )

        if reasons:
            reasons.append(
                "Prediction may be sensitive because similar sparse/ambiguous profiles can be under-represented in training data."
            )

        summary = (
            f"Uncertainty flag raised for {top_label} classification"
            if reasons
            else f"Confidence is stable for {top_label} classification"
        )

        return {
            "is_uncertain": bool(reasons),
            "summary": summary,
            "reasons": reasons,
            "recommended_action": (
                "Collect additional lead context (role clarity, skills, budget, intent notes) before prioritization."
                if reasons
                else "No additional clarification required."
            ),
            "top_label": top_label,
            "top_score": float(top_score),
            "second_label": second_label,
            "second_score": float(second_score),
            "confidence_threshold": float(self.config.confidence_threshold),
        }

    @staticmethod
    def _collect_missing_signals(record: Dict[str, Any]) -> List[str]:
        missing: List[str] = []

        string_fields = {
            "role_position": "role",
            "skills": "skills",
            "location": "location",
            "highest_education": "education",
        }

        for field, label in string_fields.items():
            value = str(record.get(field) or "").strip()
            if not value:
                missing.append(label)

        numeric_fields = {
            "years_of_experience": "experience",
            "expected_salary": "salary expectation",
        }
        for field, label in numeric_fields.items():
            try:
                value = float(record.get(field) or 0)
            except Exception:
                value = 0.0
            if value <= 0:
                missing.append(label)

        return missing

    @staticmethod
    def _top_class(probabilities: Dict[str, float]) -> Tuple[str, float]:
        if not probabilities:
            return "Uncertain", 0.0

        top_label, top_score = max(probabilities.items(), key=lambda item: float(item[1]))
        return str(top_label), float(top_score)

    @staticmethod
    def _second_class(probabilities: Dict[str, float]) -> Tuple[str, float]:
        if not probabilities:
            return "Uncertain", 0.0

        ordered = sorted(probabilities.items(), key=lambda item: float(item[1]), reverse=True)
        if len(ordered) < 2:
            return str(ordered[0][0]), float(ordered[0][1])
        return str(ordered[1][0]), float(ordered[1][1])
