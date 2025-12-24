from app.clients.backend_client import (
    get_nodes_enriched,
    post_anomaly_scores,
    post_nodes_scored,
    post_shap_explanations,
    post_fraud_explanations,
    post_nodes_viz,
)

from app.services.anomaly_detection.eif_detector import run_isolation_forest
from app.services.anomaly_detection.score_nodes import attach_scores
from app.services.explainability.shap_runner import run_shap
from app.services.explainability.shap_to_text import generate_human_explanations


def run_full_pipeline() -> None:
    """
    Runs the complete visual-analytics ML pipeline:

    1. Fetch enriched nodes from backend
    2. Run Isolation Forest (anomaly detection)
    3. Attach scores to nodes
    4. Run SHAP explainability
    5. Generate human-readable fraud explanations
    6. Generate node visualization metadata
    7. Persist everything back to backend
    """

    # --------------------------------------------------
    # 1. FETCH INPUT DATA
    # --------------------------------------------------
    nodes = get_nodes_enriched()

    if not nodes:
        print("[Visual-Analytics] No nodes received. Pipeline aborted.")
        return

    # --------------------------------------------------
    # 2. ANOMALY DETECTION
    # --------------------------------------------------
    anomaly_scores = run_isolation_forest(nodes)
    post_anomaly_scores(anomaly_scores)

    # --------------------------------------------------
    # 3. ATTACH SCORES (SINGLE SOURCE OF TRUTH)
    # --------------------------------------------------
    nodes_scored = attach_scores(nodes, anomaly_scores)
    post_nodes_scored(nodes_scored)

    # --------------------------------------------------
    # 4. SHAP EXPLAINABILITY
    # --------------------------------------------------
    shap_data = run_shap(nodes_scored)

    if shap_data:
        post_shap_explanations(shap_data)

        # --------------------------------------------------
        # 5. HUMAN FRAUD EXPLANATIONS
        # --------------------------------------------------
        fraud_explanations = generate_human_explanations(shap_data)
        post_fraud_explanations(fraud_explanations)

    # --------------------------------------------------
    # 6. NODE VISUALIZATION METADATA
    # --------------------------------------------------
    nodes_viz = []

    for node in nodes_scored:
        is_anomalous = node.get("is_anomalous", 0)

        nodes_viz.append({
            "node_id": node["node_id"],
            "color": "#ff4d4f" if is_anomalous else "#52c41a",
            "size": 20 if is_anomalous else 10,
            "viz_type": "anomalous" if is_anomalous else "normal",
            "source": "visual-analytics"
        })

    post_nodes_viz(nodes_viz)

    print("[Visual-Analytics] Full pipeline completed successfully.")
