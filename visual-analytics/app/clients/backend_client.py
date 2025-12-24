import requests
from app.config import BACKEND_BASE_URL, REQUEST_TIMEOUT


def _check_response(resp):
    if not resp.ok:
        raise RuntimeError(
            f"Backend API failed [{resp.status_code}]: {resp.text}"
        )


# -----------------------------
# READ APIs
# -----------------------------

def get_nodes_enriched():
    resp = requests.get(
        f"{BACKEND_BASE_URL}/nodes/enriched",
        timeout=REQUEST_TIMEOUT
    )
    _check_response(resp)
    return resp.json()


# -----------------------------
# WRITE APIs
# -----------------------------

def post_anomaly_scores(data):
    resp = requests.post(
        f"{BACKEND_BASE_URL}/visual/anomaly-scores/batch",
        json=data,
        timeout=REQUEST_TIMEOUT
    )
    _check_response(resp)


def post_nodes_scored(data):
    resp = requests.post(
        f"{BACKEND_BASE_URL}/nodes/scored/batch",
        json=data,
        timeout=REQUEST_TIMEOUT
    )
    _check_response(resp)


def post_shap_explanations(data):
    resp = requests.post(
        f"{BACKEND_BASE_URL}/visual/shap-explanations/batch",
        json=data,
        timeout=REQUEST_TIMEOUT
    )
    _check_response(resp)


def post_fraud_explanations(data):
    resp = requests.post(
        f"{BACKEND_BASE_URL}/visual/fraud-explanations/batch",
        json=data,
        timeout=REQUEST_TIMEOUT
    )
    _check_response(resp)


def post_nodes_viz(data):
    resp = requests.post(
        f"{BACKEND_BASE_URL}/visual/nodes-viz/batch",
        json=data,
        timeout=REQUEST_TIMEOUT
    )
    _check_response(resp)
