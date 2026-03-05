"""
MuleHunter AI — Full Solo Test Suite
Run: python test_my_work.py
API must be running on port 8001 first.
"""

import httpx
import json
import sys
import pandas as pd
from pathlib import Path

BASE     = "http://localhost:8001"
PASS     = "✅"
FAIL     = "❌"
WARN     = "⚠️ "
results  = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    print(f"  {status}  {name}" + (f" — {detail}" if detail else ""))
    return condition

def section(title):
    print(f"\n{'─'*55}")
    print(f"  {title}")
    print(f"{'─'*55}")

# ─────────────────────────────────────────────────────
# 1. FILE CHECKS
# ─────────────────────────────────────────────────────
section("1. FILE CHECKS")

shared = Path("../shared-data")
check("mule_model.pth exists",      (shared / "mule_model.pth").exists())
check("processed_graph.pt exists",  (shared / "processed_graph.pt").exists())
check("nodes.csv exists",           (shared / "nodes.csv").exists())
check("norm_params.json exists",    (shared / "norm_params.json").exists())
check("eval_report.json exists",    (shared / "eval_report.json").exists())
check("model_meta.json exists",     (shared / "model_meta.json").exists())

# ─────────────────────────────────────────────────────
# 2. NODES.CSV SANITY
# ─────────────────────────────────────────────────────
section("2. DATA SANITY")

df = pd.read_csv(shared / "nodes.csv")
check("nodes.csv has rows",         len(df) > 0,          f"{len(df):,} nodes")
check("has 'node_id' column",       "node_id" in df.columns)
check("has 'is_fraud' column",      "is_fraud" in df.columns)
check("has fraud labels",           df["is_fraud"].sum() > 0, f"{int(df['is_fraud'].sum())} fraud nodes")
check("has ring_membership col",    "ring_membership" in df.columns)
check("has community_fraud_rate",   "community_fraud_rate" in df.columns)
check("no NaN in node_id",          df["node_id"].isna().sum() == 0)

fraud_rate = df["is_fraud"].mean()
check("fraud rate is realistic",    0.01 < fraud_rate < 0.30, f"{fraud_rate:.2%}")

# Grab a real node ID for later tests
real_node_id = str(df.iloc[0]["node_id"])
fraud_node_id = str(df[df["is_fraud"] == 1].iloc[0]["node_id"]) if df["is_fraud"].sum() > 0 else real_node_id
print(f"\n  Using test node:        {real_node_id}")
print(f"  Using fraud test node:  {fraud_node_id}")

# ─────────────────────────────────────────────────────
# 3. EVAL REPORT SANITY
# ─────────────────────────────────────────────────────
section("3. MODEL PERFORMANCE")

with open(shared / "eval_report.json") as f:
    report = json.load(f)

test = report.get("test", {})
check("F1 score exists",            "f1" in test)
check("AUC score exists",           "auc_roc" in test)
check("Precision exists",           "precision" in test)
check("Recall exists",              "recall" in test)

f1  = test.get("f1", 0)
auc = test.get("auc_roc", 0)
check("F1 > 0.50 (beats random)",   f1 > 0.50,   f"F1 = {f1:.4f}")
check("AUC > 0.70",                 auc > 0.70,  f"AUC = {auc:.4f}")
check("F1 > 0.80 (target)",         f1 > 0.80,   f"{'HIT' if f1 > 0.80 else 'not yet'}")
check("AUC > 0.90 (target)",        auc > 0.90,  f"{'HIT' if auc > 0.90 else 'not yet'}")

# ─────────────────────────────────────────────────────
# 4. API CONNECTIVITY
# ─────────────────────────────────────────────────────
section("4. API CONNECTIVITY")

try:
    r = httpx.get(f"{BASE}/health", timeout=5)
    data = r.json()
    check("API is reachable",           r.status_code == 200)
    check("status is HEALTHY",          data.get("status") == "HEALTHY")
    check("model_loaded is true",       data.get("model_loaded") == True)
    check("nodes_count > 0",            data.get("nodes_count", 0) > 0, f"{data.get('nodes_count')} nodes")
    check("version is present",         bool(data.get("version")))
    check("gnn_endpoint exposed",       "gnn_endpoint" in data)
except Exception as e:
    check("API is reachable", False, str(e))
    print("\n  ⚠️  API is not running. Start it first:")
    print("     uvicorn inference_service:app --port 8001 --reload")
    sys.exit(1)

# ─────────────────────────────────────────────────────
# 5. /v1/gnn/score — SPRING BOOT CONTRACT
# ─────────────────────────────────────────────────────
section("5. /v1/gnn/score  (Spring Boot contract)")

# 5a. Known node
r = httpx.post(f"{BASE}/v1/gnn/score", json={
    "accountId": real_node_id,
    "graphFeatures": {
        "suspiciousNeighborCount": 4,
        "twoHopFraudDensity": 0.47,
        "connectivityScore": 0.82
    }
}, timeout=30)

check("returns 200",                r.status_code == 200, f"got {r.status_code}")
d = r.json()
check("has 'model' field",          d.get("model") == "GNN")
check("has 'version' field",        bool(d.get("version")))
check("has 'gnnScore'",             "gnnScore" in d)
check("has 'confidence'",           "confidence" in d)
check("has 'fraudClusterId'",       "fraudClusterId" in d)
check("has 'embeddingNorm'",        "embeddingNorm" in d)
check("gnnScore in [0,1]",          0 <= d.get("gnnScore", -1) <= 1,      f"{d.get('gnnScore'):.6f}")
check("confidence in [0,1]",        0 <= d.get("confidence", -1) <= 1,    f"{d.get('confidence'):.6f}")
check("embeddingNorm > 0",          d.get("embeddingNorm", 0) > 0,        f"{d.get('embeddingNorm'):.6f}")

# 5b. Known fraud node — should score higher
r2 = httpx.post(f"{BASE}/v1/gnn/score", json={
    "accountId": fraud_node_id,
    "graphFeatures": {}
}, timeout=30)
d2 = r2.json()
check("fraud node scores > 0.3",    d2.get("gnnScore", 0) > 0.3,         f"{d2.get('gnnScore'):.4f}")

# 5c. Unknown node (never seen in training)
r3 = httpx.post(f"{BASE}/v1/gnn/score", json={
    "accountId": "BRAND_NEW_ACCOUNT_XYZ_99999",
    "graphFeatures": {}
}, timeout=30)
check("unknown node returns 200",   r3.status_code == 200)
check("unknown node has gnnScore",  "gnnScore" in r3.json())

# 5d. Empty graphFeatures (optional field)
r4 = httpx.post(f"{BASE}/v1/gnn/score", json={
    "accountId": real_node_id
}, timeout=30)
check("missing graphFeatures ok",   r4.status_code == 200)

# ─────────────────────────────────────────────────────
# 6. /analyze-transaction — DASHBOARD ENDPOINT
# ─────────────────────────────────────────────────────
section("6. /analyze-transaction  (dashboard)")

r = httpx.post(f"{BASE}/analyze-transaction", json={
    "source_id": real_node_id,
    "target_id": "some_dest",
    "amount": 4500
}, timeout=30)

check("returns 200",                r.status_code == 200)
d = r.json()
check("has risk_score",             "risk_score" in d)
check("has verdict",                "verdict" in d)
check("has risk_factors",           "risk_factors" in d)
check("has ring_detected",          "ring_detected" in d)
check("has latency_ms",             "latency_ms" in d)
check("risk_score in [0,1]",        0 <= d.get("risk_score", -1) <= 1)
check("latency < 100ms",            d.get("latency_ms", 9999) < 100,      f"{d.get('latency_ms'):.1f}ms")
check("latency < 20ms (target)",    d.get("latency_ms", 9999) < 20,       f"{'HIT' if d.get('latency_ms', 9999) < 20 else 'needs GPU'}")

# ─────────────────────────────────────────────────────
# 7. /analyze-batch
# ─────────────────────────────────────────────────────
section("7. /analyze-batch")

r = httpx.post(f"{BASE}/analyze-batch", json={
    "transactions": [
        {"source_id": real_node_id,  "target_id": "dst1", "amount": 1000},
        {"source_id": fraud_node_id, "target_id": "dst2", "amount": 5000},
        {"source_id": "new_acc_xyz", "target_id": "dst3", "amount": 250},
    ]
}, timeout=30)

check("returns 200",                r.status_code == 200)
d = r.json()
check("has 'count' field",          d.get("count") == 3)
check("has 'flagged' field",        "flagged" in d)
check("has 'results' list",         len(d.get("results", [])) == 3)

# ─────────────────────────────────────────────────────
# 8. /detect-rings
# ─────────────────────────────────────────────────────
section("8. /detect-rings")

r = httpx.get(f"{BASE}/detect-rings?max_size=4&limit=5", timeout=60)
check("returns 200",                r.status_code == 200)
d = r.json()
check("has rings_detected field",   "rings_detected" in d)
check("has high_risk_nodes field",  "high_risk_nodes" in d)
print(f"  ℹ️   rings found: {d.get('rings_detected', 0)}")

# ─────────────────────────────────────────────────────
# 9. /cluster-report
# ─────────────────────────────────────────────────────
section("9. /cluster-report")

r = httpx.get(f"{BASE}/cluster-report", timeout=10)
check("returns 200",                r.status_code == 200)
d = r.json()
check("has total_clusters",         "total_clusters" in d)
check("has high_risk_clusters",     "high_risk_clusters" in d)
check("has top_clusters list",      isinstance(d.get("top_clusters"), list))

# ─────────────────────────────────────────────────────
# 10. /metrics
# ─────────────────────────────────────────────────────
section("10. /metrics")

r = httpx.get(f"{BASE}/metrics", timeout=10)
check("returns 200",                r.status_code == 200)
d = r.json()
check("has test metrics",           "test" in d)
check("has val metrics",            "val" in d)

# ─────────────────────────────────────────────────────
# 11. SCORE DETERMINISM
# ─────────────────────────────────────────────────────
section("11. SCORE DETERMINISM (same input = same output)")

scores = []
for _ in range(3):
    r = httpx.post(f"{BASE}/v1/gnn/score", json={
        "accountId": real_node_id,
        "graphFeatures": {"suspiciousNeighborCount": 2}
    }, timeout=30)
    scores.append(r.json().get("gnnScore"))

check("3 identical calls = same score", len(set(scores)) == 1, f"scores: {scores}")

# ─────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────
print(f"\n{'═'*55}")
passed = sum(1 for s, _, _ in results if s == PASS)
failed = sum(1 for s, _, _ in results if s == FAIL)
total  = len(results)
print(f"  RESULT:  {passed}/{total} passed   |   {failed} failed")
print(f"{'═'*55}")

if failed > 0:
    print("\n  Failed checks:")
    for s, name, detail in results:
        if s == FAIL:
            print(f"    ❌  {name}" + (f" — {detail}" if detail else ""))

if failed == 0:
    print("\n  🎉  All checks passed. Your work is bulletproof.")
else:
    print("\n  Fix the ❌ items above before connecting to Spring Boot.")