"""
MuleHunter AI - Elite Inference Service v2.0
============================================
FastAPI service with:
- /v1/gnn/score             -> Spring Boot contract (full schema per gnn_engineer_responsibilities_v2)
- /analyze-transaction      -> Real-time risk scoring with explainability
- /analyze-batch            -> Bulk transaction analysis
- /detect-rings             -> Money laundering ring detection
- /cluster-report           -> Fraud cluster summary
- /network-snapshot         -> Graph snapshot for dashboard
- /health                   -> System health + model metadata
- /metrics                  -> Model performance stats
"""

import os
import json
import logging
import time
import datetime
from pathlib import Path
from threading import Lock
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import torch
import torch.nn.functional as F
import pandas as pd
import numpy as np
import networkx as nx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from torch_geometric.nn import SAGEConv, GATConv, BatchNorm
from torch_geometric.data import Data

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("MuleHunter-AI")

# PATHS
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

MODEL_PATH = SHARED_DATA / "mule_model.pth"
GRAPH_PATH = SHARED_DATA / "processed_graph.pt"
NODES_PATH = SHARED_DATA / "nodes.csv"
NORM_PATH  = SHARED_DATA / "norm_params.json"
META_PATH  = SHARED_DATA / "model_meta.json"
EVAL_PATH  = SHARED_DATA / "eval_report.json"


# MODEL
class MuleHunterGNN(torch.nn.Module):
    def __init__(self, in_channels=20, hidden=64, out=2):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden)
        self.bn1   = BatchNorm(hidden)
        self.conv2 = GATConv(hidden, hidden, heads=4, concat=False,
                              dropout=0.3, add_self_loops=False)
        self.bn2   = BatchNorm(hidden)
        self.conv3 = SAGEConv(hidden, hidden // 2)
        self.bn3   = BatchNorm(hidden // 2)
        self.skip  = torch.nn.Linear(in_channels, hidden // 2)
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(hidden // 2, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.4),
            torch.nn.Linear(32, out),
        )

    def forward(self, x, edge_index, return_embedding=False):
        identity  = self.skip(x)
        x = F.relu(self.bn1(self.conv1(x, edge_index)))
        x = F.dropout(x, p=0.3, training=self.training)
        x = F.relu(self.bn2(self.conv2(x, edge_index)))
        x = F.dropout(x, p=0.3, training=self.training)
        x = F.relu(self.bn3(self.conv3(x, edge_index)))
        embedding = x + identity
        if return_embedding:
            return F.log_softmax(self.classifier(embedding), dim=1), embedding
        return F.log_softmax(self.classifier(embedding), dim=1)


# REQUEST SCHEMAS
class TransactionRequest(BaseModel):
    source_id:   str
    target_id:   str
    amount:      float = Field(gt=0)
    timestamp:   str   = "2025-01-01T00:00:00"
    device_type: Optional[str] = "unknown"

class BatchRequest(BaseModel):
    transactions: List[TransactionRequest]

class GraphFeatures(BaseModel):
    suspiciousNeighborCount: int   = 0
    twoHopFraudDensity:      float = 0.0
    connectivityScore:       float = 0.0

class IdentityFeatures(BaseModel):
    ja3Reuse:    int = 0
    deviceReuse: int = 0
    ipReuse:     int = 0

class BehaviorFeatures(BaseModel):
    velocity: float = 0.0
    burst:    float = 0.0

class GnnScoreRequest(BaseModel):
    accountId:        str
    graphFeatures:    GraphFeatures    = GraphFeatures()
    identityFeatures: IdentityFeatures = IdentityFeatures()
    behaviorFeatures: BehaviorFeatures = BehaviorFeatures()


# RESPONSE SCHEMAS
class RiskResponse(BaseModel):
    node_id:            str
    risk_score:         float
    verdict:            str
    risk_level:         int
    risk_factors:       List[str]
    out_degree:         int
    in_degree:          int
    community_risk:     float
    ring_detected:      bool
    network_centrality: float
    linked_accounts:    List[str]
    population_size:    int
    latency_ms:         float
    model_version:      str

class RingReport(BaseModel):
    rings_detected:  int
    rings:           List[Dict[str, Any]]
    high_risk_nodes: List[str]

class ClusterReport(BaseModel):
    total_clusters:     int
    high_risk_clusters: int
    top_clusters:       List[Dict[str, Any]]

class GnnScoreResponse(BaseModel):
    """Full schema as shown in the required output image."""
    model:   str
    version: str

    entity:            Dict[str, Any]       # type, id
    scores:            Dict[str, Any]       # gnnScore, confidence, riskLevel
    fraudCluster:      Dict[str, Any]       # clusterId, clusterSize, clusterRiskScore
    networkMetrics:    Dict[str, Any]       # suspiciousNeighbors, sharedDevices, sharedIPs, centralityScore, transactionLoops
    muleRingDetection: Dict[str, Any]       # isMuleRingMember, ringId, ringShape, ringSize, role, hubAccount, ringAccounts
    riskFactors:       List[str]
    embedding:         Dict[str, float]     # embeddingNorm
    timestamp:         str

    # flat top-level mirrors (backward compat + test_my_work.py)
    gnnScore:       float
    confidence:     float
    fraudClusterId: int
    embeddingNorm:  float


# GLOBAL STATE
model:        Optional[MuleHunterGNN] = None
base_graph:   Optional[Data]          = None
node_df:      Optional[pd.DataFrame]  = None
nx_graph:     Optional[nx.DiGraph]    = None
norm_params:  Optional[dict]          = None
model_meta:   Optional[dict]          = None
id_map:       Dict[str, int]          = {}
rev_map:      Dict[int, str]          = {}
_rings_cache: List[Dict[str, Any]]    = []

_initialized = False
_init_lock   = Lock()

FEATURE_COLS = [
    "account_age_days", "balance_mean", "balance_std",
    "tx_count", "tx_velocity_7d", "fan_out_ratio",
    "amount_entropy", "risky_email", "device_mobile",
    "device_consistency", "addr_entropy", "d_gap_mean",
    "card_network_risk", "product_code_risk", "international_flag",
    "pagerank", "in_out_ratio", "reciprocity_score",
    "community_fraud_rate", "ring_membership",
]

RISK_FACTOR_RULES = [
    ("fan_out_ratio",        0.7,  "High fan-out: distributing funds to many accounts"),
    ("tx_velocity_7d",       10,   "Burst activity: unusually high recent transaction volume"),
    ("reciprocity_score",    0.3,  "Circular flows detected: money bouncing back"),
    ("ring_membership",      1,    "Node participates in a known laundering ring"),
    ("community_fraud_rate", 0.3,  "Embedded in a high-risk fraud community"),
    # amount_entropy excluded from > rules (smurfing = LOW entropy, checked separately below)
    ("risky_email",          0.5,  "Associated with high-risk email domain"),
    ("international_flag",   0.6,  "High cross-border transaction ratio"),
    ("pagerank",             0.8,  "High centrality: hub in transaction network"),
    ("in_out_ratio",         5.0,  "Abnormal inflow vs outflow ratio"),
]


# STARTUP
def load_assets():
    global model, base_graph, node_df, nx_graph, norm_params, model_meta
    global id_map, rev_map, _rings_cache, _initialized

    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return

        logger.info("Initializing MuleHunter AI v2.0...")

        if not MODEL_PATH.exists() or not GRAPH_PATH.exists():
            logger.error("Required assets missing - run train_model.py first")
            return

        base_graph = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)
        actual_features = base_graph.x.shape[1]
        logger.info(f"   Graph: {base_graph.num_nodes:,} nodes | {actual_features} features")

        if NODES_PATH.exists():
            node_df = pd.read_csv(NODES_PATH)
            node_df["node_id"] = node_df["node_id"].astype(str)
            if "community_id" not in node_df.columns:
                node_df["community_id"] = 0
            id_map  = {nid: i for i, nid in enumerate(node_df["node_id"])}
            rev_map = {i: nid for nid, i in id_map.items()}
            logger.info(f"   Metadata: {len(node_df):,} nodes loaded")

        tx_path = SHARED_DATA / "transactions.csv"
        if tx_path.exists():
            df_tx = pd.read_csv(tx_path, nrows=50000)
            df_tx["amount"] = pd.to_numeric(df_tx["amount"], errors="coerce").fillna(1.0)
            nx_graph = nx.from_pandas_edgelist(
                df_tx, source="source", target="target",
                edge_attr="amount", create_using=nx.DiGraph()
            )
            nx.set_edge_attributes(
                nx_graph,
                {(u, v): d["amount"] for u, v, d in nx_graph.edges(data=True)},
                "weight"
            )
            logger.info(f"   NetworkX graph: {nx_graph.number_of_edges():,} edges")

            logger.info("Pre-caching rings (runs once)...")
            try:
                for cycle in nx.simple_cycles(nx_graph):
                    if 3 <= len(cycle) <= 6:
                        vol = sum(
                            nx_graph[cycle[i]][cycle[(i+1) % len(cycle)]].get("weight", 0)
                            for i in range(len(cycle))
                        )
                        _rings_cache.append({
                            "nodes":  cycle,
                            "size":   len(cycle),
                            "volume": round(vol, 2),
                            "risk":   round(min(1.0, vol / 50000), 4),
                        })
                        if len(_rings_cache) >= 200:
                            break
                _rings_cache.sort(key=lambda r: r["volume"], reverse=True)
                logger.info(f"   Cached {len(_rings_cache)} rings")
            except Exception as e:
                logger.warning(f"   Ring pre-cache skipped: {e}")

        if NORM_PATH.exists():
            with open(NORM_PATH) as f:
                norm_params = json.load(f)
        if META_PATH.exists():
            with open(META_PATH) as f:
                model_meta = json.load(f)

        model = MuleHunterGNN(in_channels=actual_features)
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        model.eval()

        _initialized = True
        logger.info(f"MuleHunter AI READY | v={model_meta.get('version','unknown') if model_meta else 'unknown'}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_assets()
    yield

app = FastAPI(
    title="MuleHunter AI - Elite Fraud Detection",
    description="Real-time GNN-based mule account detection for UPI/fintech",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# INFERENCE CORE
def _infer_node(src: str, tgt: str, amount: float):
    t0         = time.time()
    x          = base_graph.x.clone()
    edge_index = base_graph.edge_index.clone()

    if src in id_map:
        src_idx = id_map[src]
    else:
        src_idx = x.size(0)
        x = torch.cat([x, torch.full((1, x.size(1)), 0.5)], dim=0)

    if tgt in id_map:
        tgt_idx = id_map[tgt]
    else:
        tgt_idx = x.size(0)
        x = torch.cat([x, torch.full((1, x.size(1)), 0.5)], dim=0)

    edge_index = torch.cat([edge_index, torch.tensor([[src_idx], [tgt_idx]])], dim=1)

    with torch.no_grad():
        out  = model(x, edge_index)
        risk = float(out[src_idx].exp()[1])

    node_features = {}
    if node_df is not None and src in id_map:
        row = node_df[node_df["node_id"] == src].iloc[0]
        for col in FEATURE_COLS:
            if col in row.index:
                node_features[col] = float(row[col])

    return risk, node_features, src_idx, edge_index, (time.time() - t0) * 1000


def _build_risk_factors(features: dict, risk: float) -> List[str]:
    factors = []
    for col, threshold, message in RISK_FACTOR_RULES:
        if features.get(col, 0) > threshold:
            factors.append(message)
    # Smurfing: LOW amount entropy (< 0.15 normalised) = repeated round amounts
    if 0 < features.get("amount_entropy", 1.0) < 0.15:
        factors.append("Low amount diversity: possible smurfing pattern")
    if not factors and risk > 0.5:
        factors.append("Anomalous transaction graph pattern detected")
    return factors


# ENDPOINTS
@app.get("/health")
def health():
    if _initialized and model is not None:
        return {
            "status":            "HEALTHY",
            "model_loaded":      True,
            "nodes_count":       base_graph.num_nodes if base_graph else 0,
            "gnn_endpoint":      "/v1/gnn/score",
            "version":           model_meta.get("version", "unknown") if model_meta else "unknown",
            "test_f1":           model_meta.get("test_f1", 0) if model_meta else 0,
            "test_auc":          model_meta.get("test_auc", 0) if model_meta else 0,
            "optimal_threshold": model_meta.get("optimal_threshold", 0.5) if model_meta else 0.5,
            "rings_cached":      len(_rings_cache),
        }
    return {"status": "UNAVAILABLE", "model_loaded": False, "nodes_count": 0}


@app.get("/metrics")
def metrics():
    if not EVAL_PATH.exists():
        raise HTTPException(404, "Eval report not found - run train_model.py first")
    with open(EVAL_PATH) as f:
        return json.load(f)


@app.post("/analyze-transaction", response_model=RiskResponse)
def analyze(tx: TransactionRequest):
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    risk, features, src_idx, edge_index, latency = _infer_node(
        str(tx.source_id), str(tx.target_id), tx.amount
    )
    threshold    = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    block_thresh = min(0.95, threshold + 0.15)

    if risk > block_thresh:
        verdict, level = "CRITICAL - MULE ACCOUNT", 2
    elif risk > threshold:
        verdict, level = "SUSPICIOUS", 1
    else:
        verdict, level = "SAFE", 0

    linked = []
    if nx_graph and str(tx.source_id) in nx_graph:
        linked = [str(n) for n in list(nx_graph.successors(str(tx.source_id)))[:10]]

    return RiskResponse(
        node_id            = str(tx.source_id),
        risk_score         = round(risk, 4),
        verdict            = verdict,
        risk_level         = level,
        risk_factors       = _build_risk_factors(features, risk),
        out_degree         = int((edge_index[0] == src_idx).sum()),
        in_degree          = int((edge_index[1] == src_idx).sum()),
        community_risk     = round(features.get("community_fraud_rate", 0), 4),
        ring_detected      = features.get("ring_membership", 0) > 0,
        network_centrality = round(features.get("pagerank", 0), 6),
        linked_accounts    = linked,
        population_size    = base_graph.num_nodes,
        latency_ms         = round(latency, 2),
        model_version      = model_meta.get("version", "unknown") if model_meta else "unknown",
    )


@app.post("/analyze-batch")
def analyze_batch(req: BatchRequest):
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    threshold    = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    block_thresh = min(0.95, threshold + 0.15)
    results      = []

    for tx in req.transactions[:100]:
        try:
            risk, features, src_idx, edge_index, latency = _infer_node(
                str(tx.source_id), str(tx.target_id), tx.amount
            )
            verdict = "CRITICAL" if risk > block_thresh else "SUSPICIOUS" if risk > threshold else "SAFE"
            results.append({
                "source_id":  str(tx.source_id),
                "risk_score": round(risk, 4),
                "verdict":    verdict,
                "latency_ms": round(latency, 2),
            })
        except Exception as e:
            results.append({"source_id": str(tx.source_id), "error": str(e)})

    return {
        "count":   len(results),
        "flagged": sum(1 for r in results if r.get("verdict") in ["CRITICAL", "SUSPICIOUS"]),
        "results": results,
    }


@app.get("/detect-rings")
def detect_rings(max_size: int = 6, limit: int = 20):
    if not nx_graph:
        raise HTTPException(503, "Graph not loaded")
    filtered        = [r for r in _rings_cache if r["size"] <= max_size][:limit]
    high_risk_nodes = list({n for r in filtered[:5] for n in r["nodes"]})
    return RingReport(rings_detected=len(filtered), rings=filtered, high_risk_nodes=high_risk_nodes)


@app.get("/cluster-report")
def cluster_report():
    if node_df is None:
        raise HTTPException(503, "Node data not loaded")
    if "community_fraud_rate" not in node_df.columns:
        raise HTTPException(400, "Run feature_engineering.py to compute communities")

    buckets = pd.cut(node_df["community_fraud_rate"],
                     bins=[0, 0.1, 0.3, 0.6, 1.01],
                     labels=["Low", "Medium", "High", "Critical"])
    dist      = buckets.value_counts().to_dict()
    top_nodes = node_df.nlargest(10, "community_fraud_rate")[
        ["node_id", "community_fraud_rate", "is_fraud"]
    ].to_dict("records")

    return ClusterReport(
        total_clusters     = int(node_df["community_fraud_rate"].nunique()),
        high_risk_clusters = int(dist.get("High", 0) + dist.get("Critical", 0)),
        top_clusters       = top_nodes,
    )


@app.get("/network-snapshot")
def network_snapshot(limit: int = 200):
    if node_df is None or nx_graph is None:
        raise HTTPException(503, "Data not loaded")

    risk_col  = "community_fraud_rate" if "community_fraud_rate" in node_df.columns else "pagerank"
    top_df    = node_df.nlargest(limit, risk_col)
    nodes_out = [
        {
            "id":       str(row["node_id"]),
            "is_fraud": int(row.get("is_fraud", 0)),
            "risk":     round(float(row.get(risk_col, 0)), 4),
            "ring":     int(row.get("ring_membership", 0)) > 0,
            "pagerank": round(float(row.get("pagerank", 0)), 6),
        }
        for _, row in top_df.iterrows()
    ]
    node_ids  = {n["id"] for n in nodes_out}
    edges_out = [
        {"source": u, "target": v, "weight": round(d.get("weight", 1), 2)}
        for u, v, d in nx_graph.edges(data=True)
        if u in node_ids and v in node_ids
    ][:500]

    return {
        "nodes": nodes_out,
        "edges": edges_out,
        "stats": {
            "total_nodes": base_graph.num_nodes if base_graph else 0,
            "total_edges": nx_graph.number_of_edges(),
            "fraud_nodes": int(node_df["is_fraud"].sum()),
            "fraud_rate":  round(float(node_df["is_fraud"].mean()), 4),
        },
    }


# /v1/gnn/score HELPERS
def _classify_ring_shape(ring_nodes: list, g: nx.DiGraph) -> str:
    """STAR / CHAIN / CYCLE / DENSE_CLUSTER based on subgraph topology."""
    if len(ring_nodes) < 3:
        return "CYCLE"
    sub       = g.subgraph(ring_nodes)
    degrees   = [sub.out_degree(n) for n in ring_nodes]
    max_deg   = max(degrees) if degrees else 0
    n         = len(ring_nodes)
    max_edges = n * (n - 1)
    density   = sub.number_of_edges() / max_edges if max_edges else 0
    if max_deg >= n * 0.6:
        return "STAR"
    if density >= 0.6:
        return "DENSE_CLUSTER"
    if sum(1 for d in degrees if d <= 1) >= n * 0.4:
        return "CHAIN"
    return "CYCLE"


def _classify_role(account_id: str, ring_nodes: list, g: nx.DiGraph):
    """Returns (role, hub_account). Role is HUB / BRIDGE / MULE."""
    if not g.has_node(account_id) or len(ring_nodes) < 2:
        return "MULE", (ring_nodes[0] if ring_nodes else account_id)
    sub      = g.subgraph(ring_nodes)
    out_degs = {n: sub.out_degree(n) for n in ring_nodes}
    hub      = max(out_degs, key=out_degs.get)
    try:
        bc     = nx.betweenness_centrality(sub)
        avg_bc = sum(bc.values()) / len(bc) if bc else 0
        if bc.get(account_id, 0) > avg_bc * 2.0 and account_id != hub:
            return "BRIDGE", hub
    except Exception:
        pass
    return ("HUB", hub) if account_id == hub else ("MULE", hub)


# /v1/gnn/score - FULL CONTRACT ENDPOINT
@app.post("/v1/gnn/score", response_model=GnnScoreResponse)
def gnn_score(request: GnnScoreRequest):
    """
    Returns the exact required schema (as shown in the architecture image):
    entity / scores(gnnScore,confidence,riskLevel) /
    fraudCluster(clusterId,clusterSize,clusterRiskScore) /
    networkMetrics(suspiciousNeighbors,sharedDevices,sharedIPs,centralityScore,transactionLoops) /
    muleRingDetection(isMuleRingMember,ringId,ringShape,ringSize,role,hubAccount,ringAccounts) /
    riskFactors / embedding(embeddingNorm) / timestamp
    + flat top-level mirrors: gnnScore, confidence, fraudClusterId, embeddingNorm
    """
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    account_id = str(request.accountId)

    # ── 1. Resolve node ───────────────────────────────────────────────────────
    is_new  = account_id not in id_map
    src_idx = base_graph.x.size(0) if is_new else id_map[account_id]
    x          = base_graph.x.clone()
    edge_index = base_graph.edge_index.clone()
    if is_new:
        # unknown account → neutral 0.5 (not 0.0 = suspicious minimum after MinMax norm)
        x = torch.cat([x, torch.full((1, x.size(1)), 0.5)], dim=0)

    # ── 2. GNN forward pass ───────────────────────────────────────────────────
    with torch.no_grad():
        logits, embeddings = model(x, edge_index, return_embedding=True)
        probs      = logits[src_idx].exp()
        raw_score  = float(probs[1])
        confidence = float(abs(probs[1] - probs[0]))

    embedding_norm = round(float(torch.norm(embeddings[src_idx], p=2).item()), 6)

    # ── 3. Blend Spring Boot graphFeatures ────────────────────────────────────
    g               = request.graphFeatures
    neighbor_signal = min(1.0, g.suspiciousNeighborCount / 10.0)
    hop_density     = max(0.0, min(1.0, g.twoHopFraudDensity))
    has_context     = (g.suspiciousNeighborCount > 0 or g.twoHopFraudDensity > 0
                       or g.connectivityScore > 0)
    if has_context:
        gnn_score_val = round(min(1.0, max(0.0,
            0.70 * raw_score + 0.20 * hop_density + 0.10 * neighbor_signal)), 6)
    else:
        gnn_score_val = round(raw_score, 6)

    # ── 4. Risk level ─────────────────────────────────────────────────────────
    threshold    = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    block_thresh = min(0.95, threshold + 0.15)
    if gnn_score_val >= block_thresh:
        risk_level = "HIGH"
    elif gnn_score_val >= threshold:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # ── 5. Pull node metadata row ─────────────────────────────────────────────
    node_row = None
    if node_df is not None and not is_new:
        rows = node_df[node_df["node_id"] == account_id]
        if not rows.empty:
            node_row = rows.iloc[0]

    # ── 6. fraudCluster block ─────────────────────────────────────────────────
    cluster_id         = 0
    cluster_size       = 1
    cluster_risk_score = 0.0  # unknown until community data loaded

    if node_row is not None:
        cluster_id = int(node_row.get("community_id", 0))
        if "community_id" in node_df.columns:
            cluster_size = int((node_df["community_id"] == cluster_id).sum())
        if "community_fraud_rate" in node_df.columns:
            mask = node_df["community_id"] == cluster_id
            cluster_risk_score = round(
                float(node_df.loc[mask, "community_fraud_rate"].mean()), 4
            )

    # ── 7. networkMetrics block ───────────────────────────────────────────────
    suspicious_neighbors = g.suspiciousNeighborCount
    shared_devices       = request.identityFeatures.deviceReuse
    shared_ips           = request.identityFeatures.ipReuse
    centrality_score     = 0.0
    transaction_loops    = False

    if node_row is not None:
        centrality_score  = round(float(node_row.get("pagerank", 0.0)), 6)
        transaction_loops = float(node_row.get("reciprocity_score", 0.0)) > 0.1

    if nx_graph and account_id in nx_graph and node_df is not None and "is_fraud" in node_df.columns:
        fraud_set  = set(node_df[node_df["is_fraud"] == 1]["node_id"].astype(str))
        live_count = sum(1 for n in nx_graph.successors(account_id) if n in fraud_set)
        suspicious_neighbors = max(suspicious_neighbors, live_count)

    # ── 8. muleRingDetection block ────────────────────────────────────────────
    is_ring_member = node_row is not None and float(node_row.get("ring_membership", 0)) > 0
    ring_id        = 0
    ring_shape     = "CYCLE"
    ring_size      = 1
    role           = "MULE"
    hub_account    = account_id
    ring_accounts  = []

    for i, ring in enumerate(_rings_cache):
        if account_id in ring.get("nodes", []):
            is_ring_member = True
            ring_id        = i
            ring_accounts  = ring["nodes"]
            ring_size      = ring["size"]
            if nx_graph:
                ring_shape        = _classify_ring_shape(ring_accounts, nx_graph)
                role, hub_account = _classify_role(account_id, ring_accounts, nx_graph)
            break

    # ── 9. riskFactors ────────────────────────────────────────────────────────
    node_features = {}
    if node_row is not None:
        for col in FEATURE_COLS:
            if col in node_row.index:
                node_features[col] = float(node_row[col])

    risk_factors = _build_risk_factors(node_features, gnn_score_val)
    if is_ring_member:
        risk_factors.append(f"member_of_{ring_shape.lower()}_mule_ring")
    if suspicious_neighbors > 3:
        risk_factors.append("connected_to_high_risk_accounts")
    if shared_devices > 1:
        risk_factors.append("shared_device_with_multiple_accounts")
    if transaction_loops:
        risk_factors.append("rapid_pass_through_transactions")
    seen = set()
    risk_factors = [f for f in risk_factors if not (f in seen or seen.add(f))]

    version = model_meta.get("version", "GNN-v1") if model_meta else "GNN-v1"

    return GnnScoreResponse(
        model   = "GNN",
        version = version,

        entity = {
            "type": "ACCOUNT",
            "id":   account_id,
        },

        scores = {
            "gnnScore":   gnn_score_val,
            "confidence": round(confidence, 6),
            "riskLevel":  risk_level,
        },

        fraudCluster = {
            "clusterId":        cluster_id,
            "clusterSize":      cluster_size,
            "clusterRiskScore": cluster_risk_score,
        },

        networkMetrics = {
            "suspiciousNeighbors": suspicious_neighbors,
            "sharedDevices":       shared_devices,
            "sharedIPs":           shared_ips,
            "centralityScore":     centrality_score,
            "transactionLoops":    transaction_loops,
        },

        muleRingDetection = {
            "isMuleRingMember": is_ring_member,
            "ringId":           ring_id,
            "ringShape":        ring_shape,
            "ringSize":         ring_size,
            "role":             role,
            "hubAccount":       hub_account,
            "ringAccounts":     ring_accounts,
        },

        riskFactors = risk_factors,

        embedding = {
            "embeddingNorm": embedding_norm,
        },

        timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),

        # flat top-level mirrors (for test_my_work.py and Spring Boot quick access)
        gnnScore       = gnn_score_val,
        confidence     = round(confidence, 6),
        fraudClusterId = cluster_id,
        embeddingNorm  = embedding_norm,
    )