import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

# ----------------------------
# CONFIG
# ----------------------------

FEATURE_COLS = [
    "in_degree",
    "out_degree",
    "total_incoming",
    "total_outgoing",
    "risk_ratio",
]

# ----------------------------
# CORE SERVICE FUNCTION
# ----------------------------

def run_isolation_forest(nodes: list[dict]) -> list[dict]:
    """
    Runs Isolation Forest on enriched node features.

    Input:
        nodes: List of dicts from /backend/api/nodes/enriched

    Output:
        List of anomaly score dicts ready to be POSTed
        to /backend/api/visual/anomaly-scores/batch
    """

    if not nodes:
        return []

    # Convert API payload to DataFrame
    df = pd.DataFrame(nodes)

    # Safety check
    missing_cols = [c for c in FEATURE_COLS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required feature columns: {missing_cols}")

    # Feature matrix
    X = df[FEATURE_COLS].fillna(0)

    # Scale features (CRITICAL for IF)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Train Isolation Forest
    model = IsolationForest(
        n_estimators=200,
        max_samples="auto",
        contamination=0.03,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    # Compute anomaly scores
    # decision_function → higher = more normal
    raw_scores = model.decision_function(X_scaled)
    anomaly_scores = -raw_scores

    preds = model.predict(X_scaled)  # -1 = anomaly, 1 = normal

    # Prepare API payload
    results = []
    for i in range(len(df)):
        results.append({
            "node_id": int(df.iloc[i]["node_id"]),
            "anomaly_score": round(float(anomaly_scores[i]), 6),
            "is_anomalous": int(preds[i] == -1),
            "model": "isolation_forest",
            "source": "visual-analytics"
        })

    return results
