import pandas as pd
import numpy as np
import os
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHARED_DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "shared-data"))

INPUT_FILE = os.path.join(SHARED_DATA_DIR, "nodes.csv")
OUTPUT_FILE = os.path.join(SHARED_DATA_DIR, "anomaly_scores.csv")

MODEL_FILE = os.path.join(SHARED_DATA_DIR, "eif_model.pkl")
SCALER_FILE = os.path.join(SHARED_DATA_DIR, "eif_scaler.pkl")

FEATURE_COLS = [
    "in_degree",
    "out_degree",
    "total_incoming",
    "total_outgoing",
    "risk_ratio",
]


def run_isolation_forest():
    print(" Running Isolation Forest (Zero-Day Fraud Detection)...")

    # 1️ Load data
    if not os.path.exists(INPUT_FILE):
        raise FileNotFoundError(" nodes.csv not found. Run feature_engineering first.")

    df = pd.read_csv(INPUT_FILE)

    # 2️ Feature matrix
    X = df[FEATURE_COLS].fillna(0)

    # 3️ Scale features (CRITICAL)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 4️ Train Isolation Forest
    model = IsolationForest(
        n_estimators=200,
        max_samples="auto",
        contamination=0.03,  # ~3% anomalies (realistic)
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_scaled)

    # 5️ Anomaly scores
    # decision_function: higher = more normal
    # invert so higher = more risky
    raw_scores = model.decision_function(X_scaled)
    anomaly_scores = -raw_scores

    preds = model.predict(X_scaled)  # -1 = anomaly, 1 = normal

    # 6️ Output
    result = pd.DataFrame({
        "node_id": df["node_id"],
        "anomaly_score": anomaly_scores,
        "is_anomalous": (preds == -1).astype(int)
    })

    result.to_csv(OUTPUT_FILE, index=False)

    # 7️ Save model artifacts (for SHAP & reuse)
    joblib.dump(model, MODEL_FILE)
    joblib.dump(scaler, SCALER_FILE)

    print(" Isolation Forest completed successfully")
    print(f" Saved scores → {OUTPUT_FILE}")
    print(f" Saved model  → {MODEL_FILE}")
    print(f" Saved scaler → {SCALER_FILE}")


if __name__ == "__main__":
    run_isolation_forest()
