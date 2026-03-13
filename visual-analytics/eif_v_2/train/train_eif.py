import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score


# ---------------------------------------------------
# PATHS
# ---------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[3]

DATA_PATH = BASE_DIR / "shared-data" / "eif_features.csv"
MODEL_DIR = BASE_DIR / "visual-analytics" / "eif_v_2" / "models"

MODEL_PATH = MODEL_DIR / "eif_model.pkl"
SCALER_PATH = MODEL_DIR / "eif_scaler.pkl"
EVAL_PATH = MODEL_DIR / "eif_eval.json"
META_PATH = MODEL_DIR / "model_metadata.json"


# ---------------------------------------------------
# FEATURES
# ---------------------------------------------------

FEATURES = [
    "velocity_score",
    "burst_score",
    "suspicious_neighbor_count",
    "ja3_reuse_count",
    "device_reuse_count",
    "ip_reuse_count"
]


print("\n🚀 Starting EIF Training Pipeline\n")


# ---------------------------------------------------
# LOAD DATA
# ---------------------------------------------------

print("📂 Loading dataset:", DATA_PATH)

df = pd.read_csv(DATA_PATH)

print("Dataset shape:", df.shape)
print("Columns:", list(df.columns))


# ---------------------------------------------------
# VALIDATE FEATURES
# ---------------------------------------------------

missing = [f for f in FEATURES if f not in df.columns]

if missing:
    raise ValueError(f"❌ Missing features: {missing}")

print("✅ All required features present")


# ---------------------------------------------------
# EXTRACT FEATURES
# ---------------------------------------------------

X = df[FEATURES].values

y = df["is_fraud"].values if "is_fraud" in df.columns else None


print("\n🔎 Feature statistics")

for f in FEATURES:
    print(f"{f:30} min={df[f].min():.4f} max={df[f].max():.4f} mean={df[f].mean():.4f}")


# ---------------------------------------------------
# SCALE FEATURES
# ---------------------------------------------------

print("\n⚙️ Scaling features")

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)


# ---------------------------------------------------
# TRAIN MODEL
# ---------------------------------------------------

print("\n🧠 Training Isolation Forest")

model = IsolationForest(
    n_estimators=400,
    contamination=0.05,
    random_state=42,
    n_jobs=-1
)

model.fit(X_scaled)


# ---------------------------------------------------
# COMPUTE ANOMALY SCORES
# ---------------------------------------------------

scores = -model.decision_function(X_scaled)

print("\n📊 Score statistics")

print("min:", scores.min())
print("max:", scores.max())
print("mean:", scores.mean())


# ---------------------------------------------------
# THRESHOLD
# ---------------------------------------------------

threshold = np.percentile(scores, 95)

print("\n🎯 Computed anomaly threshold:", threshold)


# ---------------------------------------------------
# SAVE MODEL
# ---------------------------------------------------

MODEL_DIR.mkdir(parents=True, exist_ok=True)

joblib.dump(model, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)

print("\n💾 Model saved:", MODEL_PATH)
print("💾 Scaler saved:", SCALER_PATH)


# ---------------------------------------------------
# EVALUATION
# ---------------------------------------------------

metrics = {}

if y is not None:

    print("\n📈 Running evaluation")

    preds = (scores >= threshold).astype(int)

    f1 = f1_score(y, preds)
    precision = precision_score(y, preds)
    recall = recall_score(y, preds)
    auc = roc_auc_score(y, scores)

    metrics = {
        "f1": float(f1),
        "precision": float(precision),
        "recall": float(recall),
        "auc": float(auc),
        "threshold": float(threshold)
    }

    with open(EVAL_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n📊 Evaluation Metrics")
    print("F1 Score   :", f1)
    print("Precision  :", precision)
    print("Recall     :", recall)
    print("ROC AUC    :", auc)

else:

    metrics = {"threshold": float(threshold)}

    print("\n⚠️ No labels found. Skipping evaluation.")


# ---------------------------------------------------
# METADATA
# ---------------------------------------------------

metadata = {
    "model": "EIF",
    "version": "v3",
    "feature_dim": len(FEATURES),
    "threshold": float(threshold),
    "features": FEATURES
}

with open(META_PATH, "w") as f:
    json.dump(metadata, f, indent=2)

print("\n📦 Metadata saved:", META_PATH)


# ---------------------------------------------------
# DEBUG SAMPLE SCORES
# ---------------------------------------------------

print("\n🔬 Sample anomaly scores")

for i in range(5):
    print(f"sample {i}: score={scores[i]:.4f}")


print("\n✅ EIF Training Complete\n")