from __future__ import annotations

from typing import Any, Dict, Tuple

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

WEEKDAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    if value is None or pd.isna(value):
        return fallback
    return float(value)


def _pick_best_bucket(frame: pd.DataFrame) -> Tuple[str, float]:
    ranked = frame.sort_values(
        by=["reply_rate", "avg_response_time_hours", "interactions"],
        ascending=[False, True, False],
    )
    top = ranked.iloc[0]
    return str(top.name), _safe_float(top.get("reply_rate"), 0.0)


def _build_candidate_hours(df: pd.DataFrame) -> list[int]:
    replied_hours = (
        df.loc[df["responded"], "reply_hour"]
        .dropna()
        .astype(int)
        .tolist()
    )
    if replied_hours:
        expanded = set()
        for hour in replied_hours:
            expanded.add(hour)
            expanded.add((hour - 1) % 24)
            expanded.add((hour + 1) % 24)
        return sorted(expanded)

    sent_hours = df["sent_hour"].dropna().astype(int).unique().tolist()
    if sent_hours:
        return sorted(set(sent_hours))

    return list(range(8, 19))


def _typical_reply_hour(df: pd.DataFrame) -> int:
    replied = df.loc[df["responded"], "reply_hour"].dropna()
    if not replied.empty:
        return int(round(float(replied.median())))
    return int(df["sent_hour"].mode().iloc[0])


def _robust_avg_response_hours(df: pd.DataFrame) -> float:
    replied = df.loc[df["responded"], "response_time_hours"].dropna().astype(float)
    if replied.empty:
        return 0.0

    # Filter impossible/outlier lags so recommendations stay practical for humans.
    # Keep values in [0, 30 days] and trim the highest 10% tail.
    replied = replied[(replied >= 0) & (replied <= 24 * 30)]
    if replied.empty:
        return 0.0

    upper_bound = replied.quantile(0.9)
    clipped = replied[replied <= upper_bound]
    if clipped.empty:
        clipped = replied

    return float(clipped.mean())


def _build_ml_recommendation(df: pd.DataFrame, default_channel: str) -> Dict[str, Any]:
    if len(df) < 20:
        return {
            "model_used": "rule_based",
            "recommended_day": None,
            "recommended_hour_24": None,
            "recommended_channel": default_channel,
            "model_confidence": None,
        }

    y = df["responded"].astype(int)
    if y.nunique() < 2:
        return {
            "model_used": "rule_based",
            "recommended_day": None,
            "recommended_hour_24": None,
            "recommended_channel": default_channel,
            "model_confidence": None,
        }

    X = df[["sent_day", "sent_hour", "channel"]].copy()

    pipeline = Pipeline(
        steps=[
            (
                "prep",
                ColumnTransformer(
                    transformers=[
                        (
                            "cat",
                            OneHotEncoder(handle_unknown="ignore"),
                            ["sent_day", "channel"],
                        ),
                    ],
                    remainder="passthrough",
                ),
            ),
            ("clf", LogisticRegression(max_iter=500, class_weight="balanced")),
        ]
    )
    pipeline.fit(X, y)

    candidate_rows = []
    candidate_hours = _build_candidate_hours(df)
    for day_name in WEEKDAY_ORDER:
        for hour in candidate_hours:
            candidate_rows.append(
                {
                    "sent_day": day_name,
                    "sent_hour": hour,
                    "channel": default_channel,
                }
            )

    candidates = pd.DataFrame(candidate_rows)
    probabilities = pipeline.predict_proba(candidates)[:, 1]
    top_index = int(probabilities.argmax())
    best_row = candidates.iloc[top_index]

    return {
        "model_used": "logistic_regression",
        "recommended_day": str(best_row["sent_day"]),
        "recommended_hour_24": int(best_row["sent_hour"]),
        "recommended_channel": str(best_row["channel"]),
        "model_confidence": float(probabilities[top_index]),
    }


def analyze_patterns(df: pd.DataFrame) -> Dict[str, Any]:
    day_agg = df.groupby("sent_day").agg(
        interactions=("responded", "size"),
        reply_rate=("responded", "mean"),
    )
    day_agg["avg_response_time_hours"] = (
        df[df["responded"]].groupby("sent_day")["response_time_hours"].mean()
    )
    day_agg = day_agg.reindex([day for day in WEEKDAY_ORDER if day in day_agg.index])
    day_agg["avg_response_time_hours"] = day_agg["avg_response_time_hours"].fillna(float("inf"))

    channel_agg = df.groupby("channel").agg(
        interactions=("responded", "size"),
        reply_rate=("responded", "mean"),
    )
    channel_agg["avg_response_time_hours"] = (
        df[df["responded"]].groupby("channel")["response_time_hours"].mean()
    )
    channel_agg["avg_response_time_hours"] = channel_agg["avg_response_time_hours"].fillna(float("inf"))

    best_day, best_day_reply_rate = _pick_best_bucket(day_agg)
    best_channel, best_channel_reply_rate = _pick_best_bucket(channel_agg)

    usual_reply_hour = _typical_reply_hour(df)

    ml_recommendation = _build_ml_recommendation(df, best_channel)

    if ml_recommendation["recommended_day"] is None:
        ml_recommendation["recommended_day"] = best_day
    if ml_recommendation["recommended_hour_24"] is None:
        ml_recommendation["recommended_hour_24"] = usual_reply_hour

    avg_response = _safe_float(_robust_avg_response_hours(df), 0.0)
    total_interactions = int(len(df))
    replied_interactions = int(df["responded"].sum())
    reply_ratio = _safe_float(df["responded"].mean(), 0.0)

    # Reliability for confidence: blend data volume, reply ratio, and timing consistency.
    volume_score = min(total_interactions / 12.0, 1.0)
    replied_hours = df.loc[df["responded"], "reply_hour"].dropna()
    if replied_hours.empty:
        consistency_score = 0.0
    else:
        hour_std = float(replied_hours.std(ddof=0)) if len(replied_hours) > 1 else 0.0
        consistency_score = max(0.0, 1.0 - min(hour_std, 6.0) / 6.0)

    data_reliability = max(
        0.0,
        min(1.0, 0.45 * volume_score + 0.35 * reply_ratio + 0.20 * consistency_score),
    )

    model_confidence = ml_recommendation["model_confidence"]
    if model_confidence is None:
        model_confidence = data_reliability

    day_performance = {
        day: {
            "reply_rate": _safe_float(row["reply_rate"], 0.0),
            "avg_response_time_hours": _safe_float(row["avg_response_time_hours"], 0.0),
            "interactions": int(row["interactions"]),
        }
        for day, row in day_agg.iterrows()
    }
    channel_performance = {
        channel: {
            "reply_rate": _safe_float(row["reply_rate"], 0.0),
            "avg_response_time_hours": _safe_float(row["avg_response_time_hours"], 0.0),
            "interactions": int(row["interactions"]),
        }
        for channel, row in channel_agg.iterrows()
    }

    return {
        "best_day": best_day,
        "best_channel": best_channel,
        "avg_response_time_hours": avg_response,
        "usual_reply_hour": usual_reply_hour,
        "overall_reply_rate": reply_ratio,
        "best_day_reply_rate": best_day_reply_rate,
        "best_channel_reply_rate": best_channel_reply_rate,
        "recommended_day": ml_recommendation["recommended_day"],
        "recommended_hour_24": int(ml_recommendation["recommended_hour_24"]),
        "recommended_channel": ml_recommendation["recommended_channel"],
        "model_used": ml_recommendation["model_used"],
        "model_confidence": model_confidence,
        "data_reliability": data_reliability,
        "day_performance": day_performance,
        "channel_performance": channel_performance,
        "total_interactions": total_interactions,
        "replied_interactions": replied_interactions,
    }