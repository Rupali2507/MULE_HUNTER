import os
import logging
import torch
import torch.nn.functional as F
import pandas as pd
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel, Field
from torch_geometric.nn import SAGEConv
from torch_geometric.data import Data
from threading import Lock

# =================================================
# LOGGING
# =================================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MuleHunter-AI")

# =================================================
# PATHS (Docker-safe)
# =================================================
SHARED_DATA = "/app/shared-data"
MODEL_PATH = f"{SHARED_DATA}/mule_model.pth"
GRAPH_PATH = f"{SHARED_DATA}/processed_graph.pt"
NODES_PATH = f"{SHARED_DATA}/nodes.csv"  # OPTIONAL

# =================================================
# MODEL
# =================================================
class MuleSAGE(torch.nn.Module):
    def __init__(self, in_channels=5, hidden_channels=32, out_channels=2):
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, out_channels)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# =================================================
# SCHEMAS
# =================================================
class TransactionRequest(BaseModel):
    source_id: int
    target_id: int
    amount: float = Field(gt=0)
    timestamp: str = "2025-12-25"

class RiskResponse(BaseModel):
    node_id: int
    risk_score: float
    verdict: str
    out_degree: int
    linked_accounts: List[str]
    population_size: int
    model_version: str

# =================================================
# GLOBAL STATE
# =================================================
model: Optional[MuleSAGE] = None
base_graph: Optional[Data] = None
node_df: Optional[pd.DataFrame] = None
id_map, rev_map = {}, {}

_initialized = False
_init_lock = Lock()

# =================================================
# INIT LOGIC (BULLETPROOF)
# =================================================
def load_assets():
    global model, base_graph, node_df, id_map, rev_map, _initialized

    if _initialized:
        return

    with _init_lock:
        if _initialized:
            return

        logger.info("🔄 Initializing MuleHunter AI...")

        if not os.path.exists(MODEL_PATH) or not os.path.exists(GRAPH_PATH):
            logger.error("❌ Required assets missing")
            return

        base_graph = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)

        if os.path.exists(NODES_PATH):
            try:
                node_df = pd.read_csv(NODES_PATH)
                node_df["node_id"] = node_df["node_id"].astype(str)
                id_map = {nid: i for i, nid in enumerate(node_df["node_id"])}
                rev_map = {i: nid for nid, i in id_map.items()}
                logger.info(f"ℹ️ nodes.csv loaded ({len(node_df)})")
            except Exception as e:
                logger.warning(f"nodes.csv ignored: {e}")
                node_df = None

        model = MuleSAGE()
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        model.eval()

        _initialized = True
        logger.info(f"✅ AI READY | Nodes={base_graph.num_nodes}")

# =================================================
# FASTAPI APP
# =================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_assets()
    yield

app = FastAPI(title="Mule Hunter AI", lifespan=lifespan)

# =================================================
# HEALTH ENDPOINT (THIS FIXES YOUR UI)
# =================================================
@app.get("/health")
def health():
    return {
        "status": "READY" if _initialized else "UNAVAILABLE",
        "model_loaded": _initialized,
        "nodes_count": int(base_graph.num_nodes) if base_graph else 0,
        "version": "Kaggle-V4-Final-Inductive"
    }

# =================================================
# INFERENCE
# =================================================
@app.post("/analyze-transaction", response_model=RiskResponse)
def analyze(tx: TransactionRequest):

    if not _initialized:
        load_assets()

    x = base_graph.x.clone()
    edge_index = base_graph.edge_index.clone()

    src = str(tx.source_id)
    tgt = str(tx.target_id)

    if node_df is not None and src in id_map:
        src_idx = id_map[src]
    else:
        src_idx = x.size(0)
        x = torch.cat([x, torch.zeros((1, x.size(1)))], dim=0)

    if node_df is not None and tgt in id_map:
        tgt_idx = id_map[tgt]
    else:
        tgt_idx = x.size(0)
        x = torch.cat([x, torch.zeros((1, x.size(1)))], dim=0)

    edge_index = torch.cat(
        [edge_index, torch.tensor([[src_idx], [tgt_idx]])],
        dim=1
    )

    with torch.no_grad():
        out = model(x, edge_index)
        risk = float(out[src_idx].exp()[1])

    verdict = (
        "CRITICAL (MULE)" if risk > 0.85 else
        "SUSPICIOUS" if risk > 0.6 else
        "SAFE"
    )

    return {
        "node_id": tx.source_id,
        "risk_score": round(risk, 4),
        "verdict": verdict,
        "out_degree": int((edge_index[0] == src_idx).sum()),
        "linked_accounts": [],
        "population_size": x.size(0),
        "model_version": "Kaggle-V4-Final-Inductive"
    }
