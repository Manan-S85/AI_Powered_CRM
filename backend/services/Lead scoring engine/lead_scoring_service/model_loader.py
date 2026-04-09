import os
import pickle

# Paths (adjust if needed)
MODEL_PATH = os.path.join("ml_model", "lead_scoring_model.pkl")
ENCODER_PATH = os.path.join("ml_model", "label_encoder.pkl")

_model = None
_encoder = None


def load_model():
    global _model
    if _model is None:
        try:
            with open(MODEL_PATH, "rb") as f:
                _model = pickle.load(f)
        except Exception as e:
            raise RuntimeError(f"Error loading model: {e}")
    return _model


def load_encoder():
    global _encoder
    if _encoder is None:
        try:
            with open(ENCODER_PATH, "rb") as f:
                _encoder = pickle.load(f)
        except Exception as e:
            raise RuntimeError(f"Error loading encoder: {e}")
    return _encoder