from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

MODEL_DIR = BASE_DIR / "models"

MODEL_PATH = MODEL_DIR / "eif_model.pkl"
SCALER_PATH = MODEL_DIR / "eif_scaler.pkl"
METADATA_PATH = MODEL_DIR / "model_metadata.json"

FEATURE_NAMES = [
    "velocity_score",
    "burst_score",
    "suspicious_neighbor_count",
    "ja3_reuse_count",
    "device_reuse_count",
    "ip_reuse_count"
]

FEATURE_EXPLANATIONS = {
    "velocity_score": "High transaction velocity detected",
    "burst_score": "Sudden burst of transactions observed",
    "suspicious_neighbor_count": "Account connected to suspicious accounts in the network",
    "ja3_reuse_count": "TLS fingerprint reused across multiple accounts",
    "device_reuse_count": "Device used by multiple accounts",
    "ip_reuse_count": "IP address shared across many users"
}