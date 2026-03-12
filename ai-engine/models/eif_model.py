import joblib
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SHARED = BASE_DIR.parent.parent / "shared-data"

MODEL_PATH = SHARED / "eif_model.pkl"
SCALER_PATH = SHARED / "eif_scaler.pkl"

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

def score_eif(node_features):

    X = np.array(node_features).reshape(1, -1)

    X = scaler.transform(X)

    raw = -model.decision_function(X)[0]

    score = (raw + 0.5) / 1.0
    score = max(0.0, min(1.0, score))

    return float(score)
