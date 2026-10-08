"""Immutable model bundles with integrity/schema validation and honest failures."""
import hashlib
import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import sklearn
import xgboost

from .features import SCHEMA_VERSION, NUMERIC


class ModelUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=4)
def _load(root, manifest_stamp):
    root = Path(root)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if manifest["schema_version"] != SCHEMA_VERSION:
        raise ModelUnavailable("Unsupported feature schema")
    if manifest.get("sklearn") != sklearn.__version__ or manifest.get("xgboost") != xgboost.__version__:
        raise ModelUnavailable("Runtime versions differ from the training bundle; use the pinned ML dependencies")
    for name, digest in manifest["files"].items():
        if Path(name).name != name or hashlib.sha256((root/name).read_bytes()).hexdigest() != digest:
            raise ModelUnavailable(f"Artifact integrity check failed: {name}")
    bundle = joblib.load(root / "bundle.joblib")
    expected = NUMERIC + [f"disease_{d}" for d in bundle["disease_codes"]]
    if bundle["feature_names"] != expected:
        raise ModelUnavailable("Feature names/order mismatch")
    probe = np.zeros((1, len(expected)), dtype=np.float32)
    bundle["risk_model"].predict_proba(probe)
    bundle["risk_calibrator"].predict_proba(np.zeros((1, 1)))
    bundle["anomaly_model"].score_samples(probe)
    if bundle["forecast_model"] is not None:
        bundle["forecast_model"].predict(np.zeros((1, len(expected)+4), dtype=np.float32))
    return bundle, manifest


def load_bundle(root):
    try:
        path = Path(root)/"manifest.json"
        return _load(str(Path(root).resolve()), path.stat().st_mtime_ns)
    except Exception as exc:
        raise ModelUnavailable(f"Model bundle unavailable: {exc}") from exc


def risk_predict(bundle, X):
    p = np.clip(bundle["risk_model"].predict_proba(X.to_numpy())[:, 1], 1e-6, 1-1e-6)
    return bundle["risk_calibrator"].predict_proba(np.log(p/(1-p)).reshape(-1, 1))[:, 1]


def anomaly_predict(bundle, X):
    raw = -bundle["anomaly_model"].score_samples(X.to_numpy())
    z = np.maximum(X["zscore_28"].to_numpy(), 0)
    values = (raw if bundle["anomaly_method"] == "isolation_forest" else
              np.maximum(X["seasonal_ratio"].to_numpy(),0) if bundle["anomaly_method"] == "seasonal_deviation" else z)
    return bundle["anomaly_calibrator"].predict_proba(values.reshape(-1, 1))[:, 1]


def forecast_predict(bundle, frame, X, lead):
    from .features import forecast_features
    baseline = np.maximum(X["cases_mean_7"].to_numpy(), 0)
    if bundle["forecast_model"] is None:
        return baseline
    return np.maximum(bundle["forecast_model"].predict(forecast_features(frame, X, lead).to_numpy()), 0)
