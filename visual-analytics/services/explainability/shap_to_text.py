from typing import List, Dict
from app.services.explainability.explanation_mapper import FEATURE_EXPLANATIONS


def generate_human_explanations(
    shap_data: List[Dict]
) -> List[Dict]:
    """
    Converts SHAP feature impacts into human-readable
    fraud explanations.

    Input:
        shap_data → output of run_shap()

    Output:
        Payload ready for
        POST /backend/api/visual/fraud-explanations/batch
    """

    if not shap_data:
        return []

    explanations_output = []

    for node in shap_data:
        node_id = node.get("node_id")
        reasons = []

        for factor in node.get("top_factors", []):
            feature = factor.get("feature")
            impact = factor.get("impact", 0)

            if feature not in FEATURE_EXPLANATIONS:
                continue

            explanation = (
                FEATURE_EXPLANATIONS[feature]["positive"]
                if impact > 0
                else FEATURE_EXPLANATIONS[feature]["negative"]
            )

            # Avoid duplicate reasons
            if explanation not in reasons:
                reasons.append(explanation)

        explanations_output.append({
            "node_id": node_id,
            "reasons": reasons,
            "source": "shap-mapper"
        })

    return explanations_output
