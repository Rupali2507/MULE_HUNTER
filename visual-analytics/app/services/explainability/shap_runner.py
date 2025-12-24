import pandas as pd
import shap
from sklearn.ensemble import RandomForestClassifier
from typing import List, Dict

# ----------------------------
# CONFIG
# ----------------------------

FEATURE_COLS = [
    "in_degree",
    "out_degree",
    "total_incoming",
    "total_outgoing",
    "risk_ratio",
    "tx_velocity",
    "account_age_days",
    "balance",
]

TOP_K = 3

# ----------------------------
# CORE SERVICE FUNCTION
# ----------------------------

def run_shap(scored_nodes: List[Dict]) -> List[Dict]:
    """
    Runs SHAP explainability on anomalous nodes only
    using a surrogate RandomForest model.

    Input:
        scored_nodes → output of attach_scores()

    Output:
        SHAP explanations ready to be POSTed to
        /backend/api/visual/shap-explanations/batch
    """

    if not scored_nodes:
        return []

    df = pd.DataFrame(scored_nodes)

    # Safety checks
    required_cols = FEATURE_COLS + ["node_id", "is_anomalous", "anomaly_score"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns for SHAP: {missing}")

    # Train surrogate model
    X = df[FEATURE_COLS].fillna(0)
    y = df["is_anomalous"]

    # If no anomalies exist, SHAP makes no sense
    if y.sum() == 0:
        return []

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=6,
        random_state=42,
        class_weight="balanced",
        n_jobs=-1,
    )
    model.fit(X, y)

    # ----------------------------
    # SHAP EXPLAINER
    # ----------------------------

    explainer = shap.TreeExplainer(model)
    raw_shap_values = explainer.shap_values(X)

    # Handle different SHAP formats safely
    if isinstance(raw_shap_values, list):
        # [class_0, class_1]
        shap_values_anomalous = raw_shap_values[1]
    elif len(raw_shap_values.shape) == 3:
        # (samples, features, classes)
        shap_values_anomalous = raw_shap_values[:, :, 1]
    else:
        shap_values_anomalous = raw_shap_values

    explanations = []

    # Process only anomalous nodes
    anomalous_positions = df.index[df["is_anomalous"] == 1].tolist()

    for pos in anomalous_positions:
        contribs = shap_values_anomalous[pos]

        feature_impacts = sorted(
            zip(FEATURE_COLS, contribs),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:TOP_K]

        row = df.iloc[pos]

        explanations.append({
            "node_id": int(row["node_id"]),
            "anomaly_score": round(float(row["anomaly_score"]), 6),
            "top_factors": [
                {
                    "feature": feature,
                    "impact": round(float(impact), 6)
                }
                for feature, impact in feature_impacts
            ],
            "model": "rf_surrogate",
            "source": "shap"
        })

    return explanations
