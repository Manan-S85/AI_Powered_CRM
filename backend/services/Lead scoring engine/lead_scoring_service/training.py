from __future__ import annotations

import pandas as pd
from typing import Any, Dict

try:
    from .lead_scoring_service import train_from_historical_data
except ImportError:
    from lead_scoring_service import train_from_historical_data


def train_from_csv(csv_path: str) -> Dict[str, Any]:
    """Train the lead scoring model from a CSV containing historical closed-won/lost data."""
    dataframe = pd.read_csv(csv_path)
    records = dataframe.to_dict(orient="records")
    return train_from_historical_data(records)
