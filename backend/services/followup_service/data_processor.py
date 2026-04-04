from __future__ import annotations

from typing import Any, Dict, Iterable

import pandas as pd

REQUIRED_COLUMNS = {"sent_time", "channel"}


class FollowupDataError(ValueError):
    """Raised when follow-up optimization input data is invalid."""


def process_data(data: Iterable[Dict[str, Any]]) -> pd.DataFrame:
    """Normalize and validate interaction data for follow-up optimization."""
    if not isinstance(data, Iterable):
        raise FollowupDataError("interactions must be an iterable of objects")

    df = pd.DataFrame(list(data))
    if df.empty:
        raise FollowupDataError("at least one interaction is required")

    missing_columns = sorted(REQUIRED_COLUMNS - set(df.columns))
    if missing_columns:
        raise FollowupDataError(f"missing required column(s): {', '.join(missing_columns)}")

    df["channel"] = (
        df["channel"]
        .fillna("unknown")
        .astype(str)
        .str.strip()
        .str.lower()
        .replace("", "unknown")
    )

    # Parse timestamps while preserving user-entered wall-clock time semantics.
    df["sent_time"] = pd.to_datetime(df["sent_time"], errors="coerce")
    if "reply_time" in df.columns:
        df["reply_time"] = pd.to_datetime(df["reply_time"], errors="coerce")
    else:
        df["reply_time"] = pd.NaT

    df = df[df["sent_time"].notna()].copy()
    if df.empty:
        raise FollowupDataError("all sent_time values are invalid")

    df["responded"] = df["reply_time"].notna() & (df["reply_time"] >= df["sent_time"])
    df.loc[~df["responded"], "reply_time"] = pd.NaT

    df["response_time_hours"] = (
        (df["reply_time"] - df["sent_time"]).dt.total_seconds() / 3600
    )
    df.loc[~df["responded"], "response_time_hours"] = pd.NA

    df["sent_day"] = df["sent_time"].dt.day_name()
    df["sent_hour"] = df["sent_time"].dt.hour.astype(int)
    df["reply_day"] = df["reply_time"].dt.day_name()
    df["reply_hour"] = df["reply_time"].dt.hour

    return df