import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


FEATURE_COLS = [
    "in_degree",
    "out_degree",
    "total_incoming",
    "total_outgoing",
    "risk_ratio",
]


def run_isolation_forest(nodes: list[dict]) -> list[dict]:
    """
    Runs Isolation Forest on enriched node features.
    """

    if not nodes:
        return []

    
    normalized = []

    for n in nodes:
        try:
            normalized.append({
                "node_id": int(n["nodeId"]),
                "in_degree": float(n["inDegree"]),
                "out_degree": float(n["outDegree"]),
                "total_incoming": float(n["totalIncoming"]),
                "total_outgoing": float(n["totalOutgoing"]),
                "risk_ratio": float(n["riskRatio"]),
            })
        except KeyError as e:
            print(f"[WARN] Missing field {e} in node {n.get('nodeId')}")
        except Exception as e:
            print(f"[WARN] Invalid data for node {n.get('nodeId')}: {e}")

    df = pd.DataFrame(normalized)

    if df.empty:
        return []

   
    X = df[FEATURE_COLS].fillna(0)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

   
    model = IsolationForest(
        n_estimators=200,
        max_samples="auto",
        contamination=0.03,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    raw_scores = model.decision_function(X_scaled)
    anomaly_scores = -raw_scores
    preds = model.predict(X_scaled)

   
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
