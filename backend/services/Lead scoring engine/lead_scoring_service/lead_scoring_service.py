import pandas as pd

from model_loader import load_model, load_encoder


def _preprocess_input(lead: dict, encoder):
    """Convert input lead into model-ready DataFrame"""

    industry = lead.get("industry", "IT")
    budget = float(lead.get("budget", 0))
    response_speed = float(lead.get("response_speed", 0))
    meeting_count = float(lead.get("meeting_count", 0))
    email_open_rate = float(lead.get("email_open_rate", 0))
    website_visits = float(lead.get("website_visits", 0))

    # Safe encoding
    if industry in encoder.classes_:
        industry_encoded = encoder.transform([industry])[0]
    else:
        industry_encoded = 0  # safe fallback

    # Return as DataFrame (fixes sklearn warning)
    data = pd.DataFrame([{
        "industry": industry_encoded,
        "budget": budget,
        "response_speed": response_speed,
        "meeting_count": meeting_count,
        "email_open_rate": email_open_rate,
        "website_visits": website_visits
    }])

    return data


def predict_conversion_probability(lead: dict) -> float:
    """
    Predict probability of lead conversion

    Args:
        lead (dict): input lead data

    Returns:
        float: probability (0 to 1)
    """
    try:
        model = load_model()
        encoder = load_encoder()

        processed_input = _preprocess_input(lead, encoder)

        probability = model.predict_proba(processed_input)[0][1]

        return round(float(probability), 4)

    except Exception as e:
        print(f"❌ Lead scoring error: {e}")
        return 0.0