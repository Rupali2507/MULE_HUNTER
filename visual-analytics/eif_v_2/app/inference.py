import joblib
import numpy as np
import shap
import json

from .config import MODEL_PATH, SCALER_PATH, METADATA_PATH, FEATURE_NAMES,FEATURE_EXPLANATIONS


print("\n🚀 Loading EIF model...")

model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

with open(METADATA_PATH) as f:
    metadata = json.load(f)

threshold = metadata.get("threshold", 0.1)

if threshold < 0.01:
    threshold = 0.1

explainer = shap.TreeExplainer(model)

print("✅ Model loaded")
print("Expected features:", FEATURE_NAMES)
print("Threshold:", threshold)
print()

def generate_explanation(top_features):

    reasons = []

    for feature in top_features.keys():
        if feature in FEATURE_EXPLANATIONS:
            reasons.append(FEATURE_EXPLANATIONS[feature])

    if not reasons:
        return "No strong anomaly signals detected."

    return ", ".join(reasons) + "."


def score_eif(features):

    print("\n------------------------------")
    print("🧪 EIF INFERENCE DEBUG")
    print("------------------------------")

    print("Incoming features:", features)

    if len(features) != len(FEATURE_NAMES):
        raise ValueError(
            f"Expected {len(FEATURE_NAMES)} features, got {len(features)}"
        )

    # ------------------------------------------------
    # Convert to numpy
    # ------------------------------------------------

    X = np.array(features).reshape(1, -1)

    print("Feature vector shape:", X.shape)

    # ------------------------------------------------
    # Scaling
    # ------------------------------------------------

    X_scaled = scaler.transform(X)

    print("Scaled features:", X_scaled.tolist())

    # ------------------------------------------------
    # Raw anomaly score
    # ------------------------------------------------

    raw = -model.decision_function(X_scaled)[0]

    print("Raw anomaly score:", raw)
    print("Threshold:", threshold)

    # ------------------------------------------------
    # Normalize score
    # ------------------------------------------------

    score = raw / threshold
    score = max(0.0, min(score, 1.0))

    print("Final normalized score:", score)

    # ------------------------------------------------
    # SHAP explanation
    # ------------------------------------------------

    shap_values = explainer.shap_values(X_scaled)[0]

    shap_dict = dict(zip(FEATURE_NAMES, shap_values.tolist()))

    print("SHAP values:", shap_dict)

    # ------------------------------------------------
    # Top factors
    # ------------------------------------------------



    top_features = sorted(
        shap_dict.items(),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:3]

    top_shap = dict(top_features)

    explanation = generate_explanation(top_shap)
    print("Top contributing factors:", top_shap)
    print("------------------------------\n")


    return score, top_shap, explanation
   

  

   
    