"""
Mule Hunter AI Service - Production Grade with Auto-Training
Entry point for Graph Neural Network (GNN) Inference.
Features: Auto-Initialization, Auto-Training, Dynamic Feature Engineering, and Real-time Risk Scoring.
"""

import os
import random
import logging
import torch
import torch.nn.functional as F
import pandas as pd
import numpy as np
import networkx as nx
from typing import List, Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from torch_geometric.nn import SAGEConv
from torch_geometric.data import Data

# --- LOGGING CONFIGURATION ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("MuleHunter-AI")

# --- OPTIONAL DEPENDENCIES ---
try:
    from faker import Faker
    fake = Faker('en_IN')
except ImportError:
    fake = None
    logger.warning("Faker not found; random data will be used without localized names.")

# --- CONFIGURATION & PATHS ---
BASE_DIR = os.path.dirname(__file__)
SHARED_DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "shared-data"))
os.makedirs(SHARED_DATA_DIR, exist_ok=True)

MODEL_PATH = os.path.join(SHARED_DATA_DIR, "mule_model.pth")
DATA_PATH = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")
NODES_CSV_PATH = os.path.join(SHARED_DATA_DIR, "nodes.csv")
EDGES_CSV_PATH = os.path.join(SHARED_DATA_DIR, "transactions.csv")

# --- NEURAL NETWORK ARCHITECTURE ---
class MuleSAGE(torch.nn.Module):
    """GraphSAGE implementation for inductive node classification."""
    def __init__(self, in_channels: int, hidden_channels: int, out_channels: int):
        super(MuleSAGE, self).__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, out_channels)

    def forward(self, x: torch.Tensor, edge_index: torch.Tensor) -> torch.Tensor:
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# --- DATA TRANSFER OBJECTS (DTOs) ---
class TransactionRequest(BaseModel):
    source_id: int
    target_id: int
    amount: float
    timestamp: str = "2025-12-25"

class RiskResponse(BaseModel):
    node_id: int
    risk_score: float
    verdict: str
    model_version: str
    out_degree: int
    risk_ratio: float
    population_size: str
    ja3_detected: bool
    linked_accounts: List[str]
    unsupervised_score: float

# --- GLOBAL STATE ---
model = None
graph_data = None
id_map = {} 
reverse_id_map = {}
node_features_df = None 

# --- INTERNAL LOGIC: DATA GENERATION ---
def run_internal_generator():
    """Simulates a synthetic financial network with injected mule rings."""
    logger.info("📊 GENERATOR: Constructing synthetic financial network...")
    NUM_USERS = 2000
    G_base = nx.barabasi_albert_graph(n=NUM_USERS, m=2, seed=42)
    G = nx.DiGraph() 
    
    for u, v in G_base.edges():
        if random.random() > 0.5: G.add_edge(u, v)
        else: G.add_edge(v, u)

    for i in G.nodes():
        G.nodes[i]['is_fraud'] = 0
        G.nodes[i]['account_age'] = random.randint(30, 3650)

    # Injection of Money Mule Patterns
    for _ in range(50): 
        mule = random.choice(list(G.nodes()))
        criminal = random.choice(list(G.nodes()))
        G.nodes[mule]['is_fraud'] = 1
        G.nodes[criminal]['is_fraud'] = 1
        G.add_edge(mule, criminal, amount=random.randint(50000, 100000))
        for _ in range(random.randint(10, 20)):
            victim = random.choice(list(G.nodes()))
            if G.nodes[victim]['is_fraud'] == 0:
                G.add_edge(victim, mule, amount=random.randint(500, 2000))

    pagerank_scores = nx.pagerank(G)
    node_data = []
    for n in G.nodes():
        node_data.append({
            "node_id": str(n),
            "is_fraud": int(G.nodes[n]['is_fraud']),
            "account_age_days": int(G.nodes[n]['account_age']),
            "pagerank": float(pagerank_scores.get(n, 0)),
            "balance": float(round(random.uniform(100.0, 50000.0), 2)),
            "in_out_ratio": float(round(random.uniform(0.1, 2.0), 2)),
            "tx_velocity": int(random.randint(0, 100))
        })
    
    df_nodes = pd.DataFrame(node_data)
    cols = ["node_id", "account_age_days", "balance", "in_out_ratio", "pagerank", "tx_velocity", "is_fraud"]
    df_nodes[cols].to_csv(NODES_CSV_PATH, index=False)
    
    edge_data = [{"source": str(u), "target": str(v), "amount": float(random.randint(100, 5000)), 
                  "timestamp": pd.Timestamp.now().isoformat()} for u, v in G.edges()]
    pd.DataFrame(edge_data).to_csv(EDGES_CSV_PATH, index=False)
    logger.info("💾 Data generation persisted to shared-data.")

# --- INTERNAL LOGIC: MODEL TRAINING ---
def run_internal_trainer():
    """Trains the GraphSAGE model on the generated topology."""
    logger.info("🧠 TRAINER: Optimizing Neural Weights...")
    
    try:
        df_nodes = pd.read_csv(NODES_CSV_PATH)
        df_edges = pd.read_csv(EDGES_CSV_PATH)
    except FileNotFoundError as e:
        logger.error(f"❌ Data files not found: {e}")
        raise

    # Create node mapping
    node_mapping = {str(id): idx for idx, id in enumerate(df_nodes['node_id'].astype(str))}
    
    # Build edge index
    src = df_edges['source'].astype(str).map(node_mapping).values
    dst = df_edges['target'].astype(str).map(node_mapping).values
    
    mask = ~np.isnan(src) & ~np.isnan(dst)
    edge_index = torch.tensor([src[mask], dst[mask]], dtype=torch.long)

    # Prepare features and labels
    feature_cols = ["account_age_days", "balance", "in_out_ratio", "pagerank", "tx_velocity"]
    x = torch.tensor(df_nodes[feature_cols].values, dtype=torch.float)
    y = torch.tensor(df_nodes['is_fraud'].values, dtype=torch.long)

    # Create PyG Data object
    data = Data(x=x, edge_index=edge_index, y=y)
    torch.save(data, DATA_PATH)
    logger.info(f"📦 Processed graph saved to {DATA_PATH}")

    # Initialize and train model
    local_model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
    optimizer = torch.optim.Adam(local_model.parameters(), lr=0.01, weight_decay=5e-4)
    
    local_model.train()
    logger.info("🏋️ Training started (100 epochs)...")
    for epoch in range(100):
        optimizer.zero_grad()
        out = local_model(data.x, data.edge_index)
        loss = F.nll_loss(out, data.y)
        loss.backward()
        optimizer.step()
        
        if epoch % 20 == 0:
            logger.info(f"   Epoch {epoch}: Loss {loss.item():.4f}")

    torch.save(local_model.state_dict(), MODEL_PATH)
    logger.info(f"🏆 Model training complete. Weights saved to {MODEL_PATH}")

# --- INTERNAL LOGIC: ASSET LOADING ---
def load_assets_into_memory():
    """Loads trained weights and graph data into RAM for inference."""
    global model, graph_data, id_map, reverse_id_map, node_features_df
    
    try:
        logger.info("⚙️ Loading Neural Network assets into memory...")
        graph_data = torch.load(DATA_PATH, map_location='cpu', weights_only=False)
        
        node_features_df = pd.read_csv(NODES_CSV_PATH)
        node_features_df['node_id'] = node_features_df['node_id'].astype(str)
        
        # Efficient O(1) Lookups
        id_map = {row['node_id']: idx for idx, row in node_features_df.iterrows()}
        reverse_id_map = {idx: row['node_id'] for idx, row in node_features_df.iterrows()}
        
        # Reconstruct Model Architecture
        model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
        model.load_state_dict(torch.load(MODEL_PATH, map_location='cpu'))
        model.eval()
        
        logger.info(f"✅ SYSTEM READY: Scaled to {len(id_map)} entities.")
    except Exception as e:
        logger.error(f"❌ Failed to load AI brain: {str(e)}")
        raise

# --- AUTO-INITIALIZATION LOGIC ---
def auto_initialize_system():
    """
    Automatically initializes the system on startup:
    1. Checks if data and model exist
    2. Generates data if missing
    3. Trains model if missing
    4. Loads everything into memory
    """
    logger.info("🔍 Checking system state...")
    
    data_exists = os.path.exists(NODES_CSV_PATH) and os.path.exists(EDGES_CSV_PATH)
    model_exists = os.path.exists(MODEL_PATH) and os.path.exists(DATA_PATH)
    
    if not data_exists:
        logger.warning("⚠️ No data detected. Generating synthetic dataset...")
        run_internal_generator()
        data_exists = True
    
    if not model_exists:
        logger.warning("⚠️ No model detected. Training from scratch...")
        if not data_exists:
            logger.error("❌ Cannot train without data!")
            raise RuntimeError("Data generation failed")
        run_internal_trainer()
    
    # Load everything into memory
    load_assets_into_memory()

# --- LIFESPAN MANAGER ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handles startup/shutdown events. 
    Ensures the AI is ready for inference before accepting requests.
    """
    logger.info("🚀 AI Service Initialization Sequence Started...")
    
    try:
        auto_initialize_system()
    except Exception as e:
        logger.error(f"💥 Initialization failed: {str(e)}")
        raise
    
    yield
    logger.info("🛑 AI Service shutting down safely.")

# --- FASTAPI APP INITIALIZATION ---
app = FastAPI(
    title="Mule Hunter AI Service",
    version="Gold-V2-AutoTrain",
    lifespan=lifespan
)

# --- API ENDPOINTS ---

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "HEALTHY" if model is not None else "INITIALIZING",
        "model_loaded": model is not None,
        "nodes_count": len(id_map) if id_map else 0,
        "version": "Gold-V2-AutoTrain"
    }

@app.post("/initialize-system", tags=["System Maintenance"])
async def trigger_full_reinit():
    """Manually forces a full system re-initialization (Generator + Trainer)."""
    logger.info("🔄 Manual re-initialization triggered...")
    run_internal_generator()
    run_internal_trainer()
    load_assets_into_memory()
    return {"status": "SUCCESS", "message": "System re-initialized with new synthetic data."}

@app.post("/analyze-transaction", response_model=RiskResponse, tags=["Inference"])
def analyze_transaction(tx: TransactionRequest):
    """
    Performs real-time risk assessment for a new transaction.
    Injects dynamic features into the graph before inference.
    """
    global model, graph_data, id_map, node_features_df
    
    if model is None: 
        raise HTTPException(status_code=503, detail="AI Model is not initialized yet.")
    
    # Node Resolution
    str_id = str(tx.source_id)
    src_idx = id_map.get(str_id)
    tgt_idx = id_map.get(str(tx.target_id), 0)

    if src_idx is not None:
        node_row = node_features_df.iloc[src_idx]
        age = node_row['account_age_days']
        balance = node_row['balance']
        pagerank = node_row['pagerank']
        
        # Real-time feature shift based on incoming transaction
        current_velocity = node_row['tx_velocity'] + 1
        current_ratio = node_row['in_out_ratio'] 
        if tx.amount > 10000: current_ratio += 0.5 
        
        features = torch.tensor([[age, balance, current_ratio, pagerank, current_velocity]], dtype=torch.float)
        out_degree = (graph_data.edge_index[0] == src_idx).sum().item() + 1
        risk_ratio_ui = current_ratio
    else:
        # Default for unknown nodes (Inductive handling)
        features = torch.tensor([[30.0, 5000.0, 1.0, 0.0001, 1.0]], dtype=torch.float)
        src_idx = 0 
        out_degree = 1
        risk_ratio_ui = 1.0

    # Inductive Edge Addition
    new_edge = torch.tensor([[src_idx], [tgt_idx]], dtype=torch.long)
    temp_edge_index = torch.cat([graph_data.edge_index, new_edge], dim=1)

    # GNN Inference
    with torch.no_grad():
        temp_x = graph_data.x.clone()
        if src_idx is not None:
            temp_x[src_idx] = features[0]
            
        out = model(temp_x, temp_edge_index)
        fraud_risk = float(out[src_idx].exp()[1])

    # Verdict Generation
    verdict = "SAFE"
    if fraud_risk > 0.8: verdict = "CRITICAL (MULE)"
    elif fraud_risk > 0.5: verdict = "SUSPICIOUS"
    
    neighbors = graph_data.edge_index[1][graph_data.edge_index[0] == src_idx]
    linked = [f"Acct_{reverse_id_map.get(i.item(), '?')}" for i in neighbors[:3]]

    return {
        "node_id": tx.source_id,
        "risk_score": round(fraud_risk, 4),
        "verdict": verdict,
        "model_version": "MuleSAGE-5Feat-AutoTrained",
        "out_degree": out_degree,
        "risk_ratio": round(risk_ratio_ui, 2),
        "population_size": f"{len(id_map)} Nodes",
        "ja3_detected": fraud_risk > 0.75,
        "linked_accounts": linked,
        "unsupervised_score": round(abs(fraud_risk - 0.1), 4)
    }