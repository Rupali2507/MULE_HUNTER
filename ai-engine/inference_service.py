from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
import os
import subprocess
import logging
import pandas as pd  # Required for loading the ID mapping from CSV

# --- CONFIGURATION & PATHS ---
# We define relative paths to ensure portability across Docker and Local environments.
SHARED_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "shared-data")
MODEL_PATH = os.path.join(SHARED_DATA_DIR, "mule_model.pth")
DATA_PATH = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")
NODES_CSV_PATH = os.path.join(SHARED_DATA_DIR, "nodes.csv")  # Source of Truth for ID mapping

# --- NEURAL NETWORK ARCHITECTURE ---
class MuleSAGE(torch.nn.Module):
    """
    GraphSAGE (Graph Sample and Aggregate) Model.
    This architecture is inductive, allowing it to generate embeddings for nodes
    by aggregating features from their local neighborhoods.
    """
    def __init__(self, in_channels, hidden_channels, out_channels):
        super(MuleSAGE, self).__init__()
        # First Graph Convolution Layer: Aggregates 1-hop neighbor features
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        # Second Graph Convolution Layer: Aggregates 2-hop neighbor features
        self.conv2 = SAGEConv(hidden_channels, out_channels)

    def forward(self, x, edge_index):
        # Pass 1: Convolution -> ReLU Activation
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        # Pass 2: Convolution -> Log Softmax for Classification
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# --- DTO SCHEMAS (Data Transfer Objects) ---
class RiskRequest(BaseModel):
    node_id: int

class RiskResponse(BaseModel):
    node_id: int
    risk_score: float
    verdict: str
    model_version: str

class TransactionRequest(BaseModel):
    source_id: int
    target_id: int
    amount: float
    timestamp: str = "2025-12-25"

# --- APPLICATION LIFECYCLE ---
app = FastAPI(title="Mule Hunter AI Service", version="Final-Gold-Fixed")

# Global Variables to hold the state in memory
model = None
graph_data = None
id_map = {}  # CRITICAL: Maps Real Banking IDs (e.g., 210) to Tensor Indices (e.g., 5)

@app.on_event("startup")
def load_brain():
    """
    Initializes the AI Engine on startup.
    Loads the trained PyTorch model, the Graph structure, and builds the ID translation map.
    """
    global model, graph_data, id_map
    
    # Verify all required assets exist
    if os.path.exists(MODEL_PATH) and os.path.exists(DATA_PATH) and os.path.exists(NODES_CSV_PATH):
        try:
            print("SYSTEM STARTUP: Loading AI Assets...")
            
            # 1. Load the Graph Tensor Data (Features & Edges)
            graph_data = torch.load(DATA_PATH, weights_only=False)
            
            # 2. Build the ID Translator
            # The PyTorch geometric tensor is 0-indexed (row 0, row 1...).
            # Real banking IDs are sparse (ID 210, ID 450...).
            # We must map the Real ID to the specific Matrix Row Index.
            print("MAPPING: Building ID Translator from nodes.csv...")
            nodes_df = pd.read_csv(NODES_CSV_PATH)
            
            # Create dictionary: { Real_ID : Matrix_Index }
            # Assumption: The tensor was built iterating through this CSV in order.
            id_map = {row['node_id']: idx for idx, row in nodes_df.iterrows()}
            print(f"MAP COMPLETE: {len(id_map)} nodes indexed.")

            # 3. Load the Neural Network
            model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
            model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
            model.eval() # Set to evaluation mode (disables dropout)
            print("MODEL READY: Brain loaded successfully.")
            
        except Exception as e:
            print(f"CRITICAL FAILURE: Could not load model: {e}")
    else:
        print("⚠️ WARNING: Model or Data not found. Please run /generate-data and /train-model.")

# --- API ENDPOINTS ---

@app.post("/generate-data")
def generate_simulation():
    """Triggers the Python script to generate a new synthetic banking topology."""
    try:
        subprocess.run(["python", "data_generator.py"], check=True)
        return {"status": "New Banking Simulation Created (nodes.csv updated)"}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train-model")
def train_brain():
    """Triggers the training pipeline and reloads the model in memory."""
    try:
        subprocess.run(["python", "train_model.py"], check=True)
        # Reload to ensure the new IDs and Model Weights are active
        load_brain()
        return {"status": "Training Complete. Model & ID Map Updated."}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict", response_model=RiskResponse)
def predict_risk(request: RiskRequest):
    """
    Static Analysis Endpoint.
    Returns the fraud probability for a specific user based on the current graph state.
    """
    global model, graph_data, id_map
    
    if model is None:
        raise HTTPException(status_code=503, detail="System not ready. Call /generate-data then /train-model.")
    
    # STEP 1: Translate the requested Real ID to the internal Matrix Index
    matrix_idx = id_map.get(request.node_id)
    
    if matrix_idx is None:
        raise HTTPException(status_code=404, detail=f"User ID {request.node_id} not found in current graph.")

    # STEP 2: Inference
    with torch.no_grad():
        out = model(graph_data.x, graph_data.edge_index)
        # Extract the probability of Class 1 (Fraud) for the specific row
        fraud_risk = float(out[matrix_idx].exp()[1])

    # STEP 3: Verdict Logic
    verdict = "SAFE"
    if fraud_risk > 0.8: verdict = "CRITICAL (MULE)"
    elif fraud_risk > 0.5: verdict = "SUSPICIOUS"

    return {
        "node_id": request.node_id, 
        "risk_score": round(fraud_risk, 4), 
        "verdict": verdict, 
        "model_version": "Gold-v2-Mapped"
    }

@app.post("/analyze-transaction", response_model=RiskResponse)
def analyze_dynamic_transaction(tx: TransactionRequest):
    """
    Dynamic Orchestrator Endpoint.
    Simulates adding a new transaction edge to the graph and re-evaluating risk in real-time.
    """
    global model, graph_data, id_map
    
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    # STEP 1: Translate IDs
    src_idx = id_map.get(tx.source_id)
    tgt_idx = id_map.get(tx.target_id)
    
    print(f"ORCHESTRATOR: Validating Transaction {tx.source_id} -> {tx.target_id}")
    print(f"MAPPING: Source Index {src_idx} -> Target Index {tgt_idx}")

    # Inductive Handling: New users not in the map are treated as low-risk default
    # (In a real system, we would dynamically append them to the tensor)
    if src_idx is None:
        print("UNKNOWN USER: Source ID not found in training set. Returning SAFE default.")
        return {
            "node_id": tx.source_id,
            "risk_score": 0.0,
            "verdict": "SAFE (NEW USER)",
            "model_version": "Dynamic-Orchestrator-v2"
        }

    # Handle unknown target (e.g., paying a new merchant) by mapping to a dummy safe node (Index 0)
    # This prevents the tensor operation from crashing
    safe_target_idx = tgt_idx if tgt_idx is not None else 0

    # STEP 2: Construct Temporary Edge
    # We add a temporary edge to the graph connectivity to see how this SPECIFIC transaction changes risk
    new_edge = torch.tensor([[src_idx], [safe_target_idx]], dtype=torch.long)
    temp_edge_index = torch.cat([graph_data.edge_index, new_edge], dim=1)
    
    # STEP 3: Real-Time Inference
    with torch.no_grad():
        # Run the model on the graph WITH the new edge
        out = model(graph_data.x, temp_edge_index)
        
        # Check the risk of the Source Node (Who is sending the money?)
        fraud_risk = float(out[src_idx].exp()[1])

    # STEP 4: Verdict
    verdict = "SAFE"
    if fraud_risk > 0.8: verdict = "CRITICAL (MULE)"
    elif fraud_risk > 0.5: verdict = "SUSPICIOUS"
    
    print(f"RESULT: Risk Score {fraud_risk:.4f} | Verdict: {verdict}")

    return {
        "node_id": tx.source_id,
        "risk_score": round(fraud_risk, 4),
        "verdict": verdict,
        "model_version": "Dynamic-Orchestrator-v2"
    }