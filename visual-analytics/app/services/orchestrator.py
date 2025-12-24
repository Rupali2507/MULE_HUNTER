from app.clients.backend_client import (
    get_nodes_enriched,
    post_anomaly_scores,
    post_shap_explanations,
    post_fraud_explanations,
)

from app.services.anomaly_detection.eif_detector import run_isolation_forest
from app.services.explainability.shap_runner import run_shap
from app.services.explainability.shap_to_text import generate_human_explanations


def run_full_pipeline() -> None:
    """
    Runs full visual analytics pipeline aligned with backend schema.
    """

    print("[Visual-Analytics] Pipeline started")

    # 1️⃣ Fetch ML input
    nodes = get_nodes_enriched()
    if not nodes:
        print("[Visual-Analytics] No nodes to analyze")
        return

    # 2️⃣ Anomaly detection
    anomaly_scores = run_isolation_forest(nodes)
    post_anomaly_scores(anomaly_scores)

    # 3️⃣ Merge anomaly scores ONLY for SHAP computation
    score_map = {s["node_id"]: s for s in anomaly_scores}

    scored_nodes = []
    for node in nodes:
        score = score_map.get(node["node_id"], {})
        scored_nodes.append({
            **node,
            "anomaly_score": score.get("anomaly_score"),
            "is_anomalous": score.get("is_anomalous", 0),
        })

    # 4️⃣ SHAP explainability
    shap_data = run_shap(scored_nodes)

    if shap_data:
        post_shap_explanations(shap_data)

        # 5️⃣ Human-readable fraud explanations
        fraud_explanations = generate_human_explanations(shap_data)
        post_fraud_explanations(fraud_explanations)

    print("[Visual-Analytics] Pipeline completed successfully")
