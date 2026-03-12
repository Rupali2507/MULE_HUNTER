import json
import logging
from pathlib import Path

import torch
import numpy as np
import joblib

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MuleHunter-EIF")

BASE_DIR = Path(__file__).resolve().parent
SHARED_DATA = BASE_DIR.parent / "shared-data"

GRAPH_PATH = SHARED_DATA / "processed_graph.pt"
EIF_MODEL_PATH = SHARED_DATA / "eif_model.pkl"
EIF_SCALER_PATH = SHARED_DATA / "eif_scaler.pkl"
EIF_REPORT_PATH = SHARED_DATA / "eif_eval.json"


def train():

    logger.info("🚀 Training EIF")

    data = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)

    X = data.x.numpy()
    y = data.y.numpy()

    train_mask = data.train_mask.numpy()
    test_mask = data.test_mask.numpy()

    X_train = X[train_mask]
    y_train = y[train_mask]

    # Train only on NORMAL nodes
    X_normal = X_train[y_train == 0]

    logger.info(f"Training EIF on {len(X_normal):,} normal nodes")

    # Scale features
    scaler = StandardScaler()
    X_normal_scaled = scaler.fit_transform(X_normal)

    model = IsolationForest(
        n_estimators=400,
        contamination=0.05,
        random_state=42,
        n_jobs=-1
    )

    model.fit(X_normal_scaled)

    joblib.dump(model, EIF_MODEL_PATH)
    joblib.dump(scaler, EIF_SCALER_PATH)

    logger.info(f"💾 EIF saved → {EIF_MODEL_PATH}")
    logger.info(f"💾 Scaler saved → {EIF_SCALER_PATH}")

    # -------------------
    # Evaluation
    # -------------------

    X_test = X[test_mask]
    y_test = y[test_mask]

    X_test_scaled = scaler.transform(X_test)

    scores = -model.decision_function(X_test_scaled)

    threshold = np.percentile(scores, 95)

    preds = (scores >= threshold).astype(int)

    metrics = {
        "f1": float(f1_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds)),
        "recall": float(recall_score(y_test, preds)),
        "auc": float(roc_auc_score(y_test, scores)),
        "threshold": float(threshold)
    }

    logger.info(metrics)

    with open(EIF_REPORT_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(f"📊 EIF evaluation saved → {EIF_REPORT_PATH}")


if __name__ == "__main__":
    train()