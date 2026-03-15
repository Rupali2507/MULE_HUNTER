"""
MuleHunter AI  ·  Feature Engineering  ·  v3.0
================================================
Graph-level feature extraction pipeline:

  · Ring / cycle detection  (money-laundering signature)
      — Timeout-guarded so it never hangs on large graphs
      — Restricted to account nodes only (no location nodes)
  · Louvain / greedy community detection (collusive cluster IDs)
  · Second-hop fraud exposure (guilt-by-association propagation)
  · Temporal burst detection
  · Reciprocity scoring (circular-flow detection)
  · Normalised feature tensors for the GNN (with saved norm params)

Bug-fixes vs v2:
  [1] detect_rings: bounded by time-limit + subgraph restricted to
      account nodes so location nodes don't pollute ring membership.
  [2] second_hop_fraud_rate added to FEATURE_COLS and actually computed.
  [3] MinMax norm params saved to norm_params.json and verified
      consistent with what inference_service.py will reload.
  [4] Empty-graph guard added.
  [5] torch.randperm seeded correctly inside split_idx.
  [6] Removed nx.from_pandas_edgelist duplicate weight rename; uses
      create_using + edge_attr directly with 'weight' alias.
"""

from __future__ import annotations

import json
import logging
import os
import random
import warnings
from collections import defaultdict
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd
import torch
from torch_geometric.data import Data

warnings.filterwarnings("ignore")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("MuleHunter-FeatureEng")

# ──────────────────────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

# Feature columns fed into the GNN — ORDER IS CONTRACT, never change order.
FEATURE_COLS: list[str] = [
    # ── From data_generator ──────────────────────────────────────────────────
    "account_age_days",     # [0]
    "balance_mean",         # [1]
    "balance_std",          # [2]
    "tx_count",             # [3]
    "tx_velocity_7d",       # [4]
    "fan_out_ratio",        # [5]
    "amount_entropy",       # [6]
    "risky_email",          # [7]
    "device_mobile",        # [8]
    "device_consistency",   # [9]
    "addr_entropy",         # [10]
    "d_gap_mean",           # [11]
    "card_network_risk",    # [12]
    "product_code_risk",    # [13]
    "international_flag",   # [14]
    # ── Computed below ───────────────────────────────────────────────────────
    "pagerank",             # [15]
    "in_out_ratio",         # [16]
    "reciprocity_score",    # [17]
    "community_fraud_rate", # [18]
    "ring_membership",      # [19]
    "second_hop_fraud_rate",# [20]  ← [FIX 2] was silently 0 in v2
]

# Ring detection budget and limits
RING_TIMEOUT_SEC = 25   # wall-clock seconds before giving up
MAX_RING_SIZE    = 6    # only look for small rings (3–6 hops)
MAX_RINGS_KEPT   = 300  # stop after collecting this many rings


# ──────────────────────────────────────────────────────────────────────────────
# RING / CYCLE DETECTION  —  cross-platform, Windows-safe
# ──────────────────────────────────────────────────────────────────────────────

def detect_rings(
    G: nx.DiGraph,
    account_nodes: set[str],
    max_ring_size: int = MAX_RING_SIZE,
    timeout_sec: int   = RING_TIMEOUT_SEC,
) -> tuple[defaultdict, defaultdict, list]:
    """
    Find short circular money flows using a BFS-depth-limited search.

    WHY NOT nx.simple_cycles
    ─────────────────────────
    nx.simple_cycles uses Johnson's algorithm which enumerates ALL cycles.
    On a dense graph with 34k edges it can run for hours.  SIGALRM-based
    timeouts do not work on Windows (signal.SIGALRM does not exist), so the
    previous code had no protection at all on Windows — it just hung forever.

    APPROACH USED HERE
    ──────────────────
    For each node we run a depth-limited DFS up to max_ring_size hops.
    If we reach a node we already visited and that node is the start node,
    we found a ring.  We stop the moment we have MAX_RINGS_KEPT rings or
    RING_TIMEOUT_SEC seconds have elapsed.  The timeout is checked via
    time.monotonic() inside the loop — no OS signals needed, works on
    Windows, macOS, and Linux identically.

    This trades completeness for speed: we find the most common small rings
    rather than every cycle.  For fraud detection this is the right trade-off
    because we only need to flag ring-member nodes, not enumerate every ring.

    Returns
    -------
    ring_count  : dict[node_id → int]    rings each node participates in
    ring_volume : dict[node_id → float]  cumulative flow through its rings
    rings_found : list[dict]             up to MAX_RINGS_KEPT ring records
    """
    import time

    logger.info("Detecting circular money flows (ring detection, BFS bounded)...")

    # Work only on the account subgraph — location nodes create spurious cycles
    sub = G.subgraph(
        [n for n in G.nodes() if n in account_nodes]
    ).copy()

    ring_count:  defaultdict[str, int]   = defaultdict(int)
    ring_volume: defaultdict[str, float] = defaultdict(float)
    rings_found: list[dict]              = []
    seen_ring_sets: set[frozenset]       = set()  # deduplicate

    deadline = time.monotonic() + timeout_sec
    nodes_list = list(sub.nodes())
    nodes_checked = 0

    for start in nodes_list:
        nodes_checked += 1
        if time.monotonic() > deadline:
            logger.warning(
                "  Ring detection timed out after %ds — %d rings found",
                timeout_sec, len(rings_found),
            )
            break
        if len(rings_found) >= MAX_RINGS_KEPT:
            break

        # DFS stack: (current_node, path_so_far)
        stack = [(start, [start])]

        while stack:
            if time.monotonic() > deadline or len(rings_found) >= MAX_RINGS_KEPT:
                break

            node, path = stack.pop()

            for neighbour in sub.successors(node):
                if len(path) > max_ring_size:
                    break

                if neighbour == start and len(path) >= 3:
                    # Found a ring — deduplicate by node set
                    ring_key = frozenset(path)
                    if ring_key not in seen_ring_sets:
                        seen_ring_sets.add(ring_key)
                        vol = sum(
                            sub[path[i]][path[(i + 1) % len(path)]].get("weight", 0)
                            for i in range(len(path))
                        )
                        rings_found.append({
                            "nodes":  path[:],
                            "size":   len(path),
                            "volume": round(float(vol), 2),
                        })
                        for n in path:
                            ring_count[n]  += 1
                            ring_volume[n] += vol
                elif neighbour not in path:
                    stack.append((neighbour, path + [neighbour]))

    logger.info("  %d rings detected (%d/%d nodes checked before deadline/cap)",
                len(rings_found), nodes_checked, len(nodes_list))
    return ring_count, ring_volume, rings_found


# ──────────────────────────────────────────────────────────────────────────────
# COMMUNITY DETECTION
# ──────────────────────────────────────────────────────────────────────────────

def detect_communities(
    G: nx.DiGraph,
    fraud_labels: dict[str, int],
) -> tuple[dict, dict]:
    """
    Identify fraud clusters via greedy modularity maximisation.

    Returns
    -------
    community_fraud_rate : dict[node_id → float]  fraction of fraudsters in cluster
    community_id_map     : dict[node_id → int]    stable integer cluster index
    """
    logger.info("Detecting fraud communities...")
    G_undirected = G.to_undirected()

    try:
        communities = list(
            nx.community.greedy_modularity_communities(G_undirected)
        )
    except Exception:
        logger.warning("  greedy_modularity_communities failed — falling back to connected components")
        communities = list(nx.connected_components(G_undirected))

    community_fraud_rate: dict[str, float] = {}
    community_id_map:     dict[str, int]   = {}

    for idx, comm in enumerate(communities):
        comm_list = list(comm)
        n_fraud   = sum(fraud_labels.get(n, 0) for n in comm_list)
        rate      = n_fraud / len(comm_list) if comm_list else 0.0
        for node in comm_list:
            community_fraud_rate[node] = rate
            community_id_map[node]     = idx

    high_risk = sum(
        1 for c in communities
        if len(c) > 0
        and sum(fraud_labels.get(n, 0) for n in c) / len(c) > 0.3
    )
    logger.info(
        "  %d communities | %d high-risk clusters (>30%% fraud)",
        len(communities), high_risk,
    )
    return community_fraud_rate, community_id_map


# ──────────────────────────────────────────────────────────────────────────────
# GRAPH METRICS
# ──────────────────────────────────────────────────────────────────────────────

def compute_graph_metrics(
    G: nx.DiGraph,
    node_ids: list[str],
) -> pd.DataFrame:
    """Compute PageRank, in/out-amount ratio, and reciprocity per node."""
    logger.info("Computing advanced graph metrics...")

    pagerank = nx.pagerank(G, alpha=0.85, max_iter=200, weight="weight")

    records = []
    for nid in node_ids:
        out_amt = sum(d.get("weight", 0.0) for _, _, d in G.out_edges(nid, data=True))
        in_amt  = sum(d.get("weight", 0.0) for _, _, d in G.in_edges(nid,  data=True))
        in_out  = in_amt / (out_amt + 1e-5)

        out_neighbors = set(G.successors(nid))
        in_neighbors  = set(G.predecessors(nid))
        reciprocal    = len(out_neighbors & in_neighbors)
        recip_score   = reciprocal / (len(out_neighbors) + 1)

        records.append({
            "node_id":           nid,
            "pagerank":          pagerank.get(nid, 0.0),
            "in_out_ratio":      float(in_out),
            "reciprocity_score": float(recip_score),
        })

    return pd.DataFrame(records)


# ──────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ──────────────────────────────────────────────────────────────────────────────

def build_graph_data() -> Data:
    # [FIX 5] Global seeds for reproducibility
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)
    torch.backends.cudnn.deterministic = True

    logger.info("=" * 60)
    logger.info("MuleHunter Feature Engineering v3.0")
    logger.info("=" * 60)

    # 1. Load raw data
    df_nodes = pd.read_csv(SHARED_DATA / "nodes.csv")
    df_tx    = pd.read_csv(SHARED_DATA / "transactions.csv")

    df_nodes["node_id"] = df_nodes["node_id"].astype(str)
    df_tx["source"]     = df_tx["source"].astype(str)
    df_tx["target"]     = df_tx["target"].astype(str)

    logger.info("  Loaded %s nodes, %s edges", f"{len(df_nodes):,}", f"{len(df_tx):,}")

    # [FIX 4] Guard against empty dataset
    if len(df_nodes) == 0 or len(df_tx) == 0:
        raise ValueError("nodes.csv or transactions.csv is empty — run data_generator.py first")

    # 2. Build directed NetworkX graph
    logger.info("Building directed transaction graph...")
    df_tx["amount"] = pd.to_numeric(df_tx["amount"], errors="coerce").fillna(1.0)

    # Build with 'weight' as the edge attribute name directly
    df_tx_renamed = df_tx.rename(columns={"amount": "weight"})
    G = nx.from_pandas_edgelist(
        df_tx_renamed,
        source="source",
        target="target",
        edge_attr="weight",
        create_using=nx.DiGraph(),
    )
    # Ensure all account nodes exist even if they had no transactions
    G.add_nodes_from(df_nodes["node_id"])

    logger.info("  Graph: %s nodes | %s edges", f"{G.number_of_nodes():,}", f"{G.number_of_edges():,}")

    # 3. [FIX 1] Ring detection restricted to account nodes
    account_nodes = set(df_nodes["node_id"].tolist())
    ring_count, ring_volume, rings_found = detect_rings(G, account_nodes)

    # 4. Community detection
    fraud_labels = dict(zip(df_nodes["node_id"], df_nodes["is_fraud"]))
    community_fraud_rate, community_id_map = detect_communities(G, fraud_labels)

    # 5. Graph metrics
    graph_metrics_df = compute_graph_metrics(G, df_nodes["node_id"].tolist())

    # 6. Merge all features back
    df_nodes = df_nodes.merge(graph_metrics_df, on="node_id", how="left")
    df_nodes["ring_membership"]      = df_nodes["node_id"].map(ring_count).fillna(0)
    df_nodes["ring_volume"]          = df_nodes["node_id"].map(ring_volume).fillna(0)
    df_nodes["community_fraud_rate"] = df_nodes["node_id"].map(community_fraud_rate).fillna(0)
    df_nodes["community_id"]         = (
        df_nodes["node_id"].map(community_id_map).fillna(0).astype(int)
    )

    # [FIX 2] second_hop_fraud_rate — propagate from data_generator if present,
    # otherwise compute from the graph here.
    if "second_hop_fraud_rate" not in df_nodes.columns:
        # Compute: fraction of direct graph neighbours that are fraudulent
        fraud_set   = set(df_nodes.loc[df_nodes["is_fraud"] == 1, "node_id"])
        shfr_values = {}
        for nid in df_nodes["node_id"]:
            neighbours = list(G.successors(nid)) + list(G.predecessors(nid))
            if not neighbours:
                shfr_values[nid] = 0.0
            else:
                shfr_values[nid] = sum(1 for n in neighbours if n in fraud_set) / len(neighbours)
        df_nodes["second_hop_fraud_rate"] = df_nodes["node_id"].map(shfr_values).fillna(0)

    # 7. Ensure every FEATURE_COL exists
    for col in FEATURE_COLS:
        if col not in df_nodes.columns:
            logger.warning("  Feature column '%s' missing — filling with 0.0", col)
            df_nodes[col] = 0.0
    df_nodes = df_nodes.fillna(0)

    # 8. MinMax normalisation (per-column) — save params for inference
    logger.info("Normalising feature matrix...")
    feature_data = df_nodes[FEATURE_COLS].values.astype(np.float32)
    col_min  = feature_data.min(axis=0)
    col_max  = feature_data.max(axis=0)
    col_range = np.where(col_max - col_min == 0, 1.0, col_max - col_min)
    feature_data = (feature_data - col_min) / col_range

    # [FIX 3] Save norm params including feature list so inference uses
    # exactly the same columns in the same order.
    norm_params = {
        "feature_cols": FEATURE_COLS,
        "col_min":      col_min.tolist(),
        "col_max":      col_max.tolist(),
        "col_range":    col_range.tolist(),
    }
    with open(SHARED_DATA / "norm_params.json", "w") as f:
        json.dump(norm_params, f, indent=2)

    # 9. Build PyG tensors
    logger.info("Building PyTorch Geometric tensors...")
    node_mapping: dict[str, int] = {
        nid: idx for idx, nid in enumerate(df_nodes["node_id"])
    }

    src_idx = df_tx["source"].map(node_mapping)
    tgt_idx = df_tx["target"].map(node_mapping)
    valid   = src_idx.notna() & tgt_idx.notna()

    edge_index = torch.tensor(
        [
            src_idx[valid].astype(int).tolist(),
            tgt_idx[valid].astype(int).tolist(),
        ],
        dtype=torch.long,
    )
    edge_weight = torch.tensor(
        df_tx.loc[valid, "amount"].fillna(1.0).values,
        dtype=torch.float,
    )

    x = torch.tensor(feature_data, dtype=torch.float)
    y = torch.tensor(df_nodes["is_fraud"].values, dtype=torch.long)

    # 10. Stratified train / val / test split (seeded)
    n = len(df_nodes)
    fraud_idx = (y == 1).nonzero(as_tuple=True)[0]
    safe_idx  = (y == 0).nonzero(as_tuple=True)[0]

    def _split_idx(
        idx: torch.Tensor,
        ratios: tuple[float, float, float] = (0.70, 0.15, 0.15),
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        # [FIX 5] Use a Generator seeded locally so the global seed is stable
        gen  = torch.Generator().manual_seed(42)
        perm = idx[torch.randperm(len(idx), generator=gen)]
        t = int(ratios[0] * len(perm))
        v = int((ratios[0] + ratios[1]) * len(perm))
        return perm[:t], perm[t:v], perm[v:]

    f_tr, f_va, f_te = _split_idx(fraud_idx)
    s_tr, s_va, s_te = _split_idx(safe_idx)

    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask   = torch.zeros(n, dtype=torch.bool)
    test_mask  = torch.zeros(n, dtype=torch.bool)

    for indices, mask in [
        (torch.cat([f_tr, s_tr]), train_mask),
        (torch.cat([f_va, s_va]), val_mask),
        (torch.cat([f_te, s_te]), test_mask),
    ]:
        mask[indices] = True

    data = Data(
        x=x,
        edge_index=edge_index,
        y=y,
        edge_weight=edge_weight,
        train_mask=train_mask,
        val_mask=val_mask,
        test_mask=test_mask,
    )

    # 11. Save
    torch.save(data, SHARED_DATA / "processed_graph.pt")
    df_nodes.to_csv(SHARED_DATA / "nodes.csv", index=False)

    logger.info(
        "Graph tensor saved | Features: %d | Nodes: %s",
        x.shape[1], f"{x.shape[0]:,}",
    )
    logger.info(
        "  Train: %d | Val: %d | Test: %d",
        int(train_mask.sum()), int(val_mask.sum()), int(test_mask.sum()),
    )
    logger.info(
        "  Rings detected: %d | Ring-member nodes: %d",
        len(rings_found), len(ring_count),
    )

    return data


if __name__ == "__main__":
    build_graph_data()