import pandas as pd
import joblib
import json
from pathlib import Path

from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score

BASE = Path(__file__).resolve().parent
SHARED = BASE.parent / "shared-data"

MODEL_PATH = SHARED / "eif_model.pkl"
SCALER_PATH = SHARED / "eif_scaler.pkl"
REPORT_PATH = SHARED / "eif_eval.json"

nodes = pd.read_csv(SHARED / "nodes.csv")

FEATURE_COLS = [
    "account_age_days","balance_mean","balance_std",
    "tx_count","tx_velocity_7d","fan_out_ratio",
    "amount_entropy","risky_email","device_mobile",
    "device_consistency","addr_entropy","d_gap_mean",
    "card_network_risk","product_code_risk","international_flag",
    "pagerank","in_out_ratio","reciprocity_score",
    "community_fraud_rate","ring_membership"
]

X = nodes[FEATURE_COLS]
y = nodes["is_fraud"]

# ─────────────────────────────────────
# Scaling
# ─────────────────────────────────────
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ─────────────────────────────────────
# Train Isolation Forest
# ─────────────────────────────────────
model = IsolationForest(
    n_estimators=200,
    contamination=0.02,
    random_state=42
)

model.fit(X_scaled)

# ─────────────────────────────────────
# Compute anomaly scores
# ─────────────────────────────────────
scores = -model.decision_function(X_scaled)

# normalize scores 0-1
scores = (scores - scores.min()) / (scores.max() - scores.min())

pred = (scores > 0.5).astype(int)

# ─────────────────────────────────────
# Evaluation
# ─────────────────────────────────────
f1 = f1_score(y, pred)
precision = precision_score(y, pred)
recall = recall_score(y, pred)
auc = roc_auc_score(y, scores)

report = {
    "f1": float(f1),
    "precision": float(precision),
    "recall": float(recall),
    "auc": float(auc)
}

# ─────────────────────────────────────
# Save model + scaler
# ─────────────────────────────────────
joblib.dump(model, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)

with open(REPORT_PATH, "w") as f:
    json.dump(report, f, indent=2)

print("\nEIF Evaluation")
print(report)
print("\n✅ EIF model saved")