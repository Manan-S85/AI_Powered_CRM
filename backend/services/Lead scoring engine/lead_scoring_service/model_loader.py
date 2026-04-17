import json
import os
import pickle
from pathlib import Path
from typing import Any, Dict


MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parents[3]

# Prefer the new canonical conversion-model location first.
CANONICAL_ARTIFACT_DIR = PROJECT_ROOT / "ml_model" / "models" / "lead scoring engine"
ALT_ARTIFACT_DIR = PROJECT_ROOT / "ml_model" / "lead scoring engine"
MODELS_ROOT_ARTIFACT_DIR = PROJECT_ROOT / "ml_model" / "models"
LEGACY_ARTIFACT_DIR = PROJECT_ROOT / "ml_model"


def _has_required_artifacts(artifact_dir: Path) -> bool:
    return (artifact_dir / "lead_scoring_model.pkl").exists() and (artifact_dir / "label_encoder.pkl").exists()


def _resolve_artifact_dir() -> Path:
    env_override = os.getenv("LEAD_SCORING_ARTIFACT_DIR")
    if env_override:
        return Path(env_override).resolve()

    candidates = [
        CANONICAL_ARTIFACT_DIR,
        ALT_ARTIFACT_DIR,
        MODELS_ROOT_ARTIFACT_DIR,
        LEGACY_ARTIFACT_DIR,
    ]

    for candidate in candidates:
        if _has_required_artifacts(candidate):
            return candidate.resolve()

    # Default to canonical folder; training endpoints will create it when saving artifacts.
    return CANONICAL_ARTIFACT_DIR.resolve()


ARTIFACT_DIR = _resolve_artifact_dir()

MODEL_PATH = ARTIFACT_DIR / "lead_scoring_model.pkl"
ENCODER_PATH = ARTIFACT_DIR / "label_encoder.pkl"
METADATA_PATH = ARTIFACT_DIR / "lead_scoring_metadata.json"

_model = None
_encoder = None
_metadata = None


def _load_pickle(path: Path, kind: str) -> Any:
    if not path.exists():
        raise FileNotFoundError(
            f"{kind} artifact not found at '{path}'. Train the model before inference."
        )

    try:
        with path.open("rb") as file_handle:
            return pickle.load(file_handle)
    except Exception as error:
        raise RuntimeError(f"Failed to load {kind} artifact from '{path}': {error}") from error


def _write_pickle(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as file_handle:
        pickle.dump(payload, file_handle)


def reset_cache() -> None:
    """Clear in-memory model artifacts cache."""
    global _model, _encoder, _metadata
    _model = None
    _encoder = None
    _metadata = None


def load_model() -> Any:
    global _model
    if _model is None:
        _model = _load_pickle(MODEL_PATH, "model")
    return _model


def load_encoder() -> Any:
    global _encoder
    if _encoder is None:
        _encoder = _load_pickle(ENCODER_PATH, "encoder")
    return _encoder


def load_metadata() -> Dict[str, Any]:
    global _metadata
    if _metadata is not None:
        return _metadata

    if not METADATA_PATH.exists():
        _metadata = {}
        return _metadata

    try:
        _metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        return _metadata
    except Exception as error:
        raise RuntimeError(f"Failed to load metadata from '{METADATA_PATH}': {error}") from error


def save_artifacts(model: Any, encoder: Any, metadata: Dict[str, Any]) -> None:
    """Persist model, encoder and metadata to the configured artifact directory."""
    _write_pickle(MODEL_PATH, model)
    _write_pickle(ENCODER_PATH, encoder)

    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    reset_cache()