from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
import os
import subprocess  

# --- CONFIGURATION ---
SHARED_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "shared-data")
MODEL_PATH = os.path.join(SHARED_DATA_DIR, "mule_model.pth")
DATA_PATH = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")

# --- DEFINING THE BRAIN ---
class MuleSAGE(torch.nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels):
        super(MuleSAGE, self).__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, out_channels)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# --- API SCHEMAS ---
class RiskRequest(BaseModel):
    node_id: int

class RiskResponse(BaseModel):
    node_id: int
    risk_score: float
    verdict: str
    model_version: str

# --- INITIALIZING THE APP ---
app = FastAPI(title="Mule Hunter AI Service", version="Final-Gold")

model = None
graph_data = None

@app.on_event("startup")
def load_brain():
    global model, graph_data
    if os.path.exists(MODEL_PATH) and os.path.exists(DATA_PATH):
        try:
            graph_data = torch.load(DATA_PATH, weights_only=False)
            model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
            model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
            model.eval()
            print("Brain loaded.")
        except Exception as e:
            print(f"Load failed: {e}")

# --- 1. GENERATE DATA ENDPOINT (MISSING IN YOURS) ---
@app.post("/generate-data")
def generate_simulation():
    """For data simulation"""
    try:
        subprocess.run(["python", "data_generator.py"], check=True)
        return {"status": "New Banking Simulation Created (nodes.csv updated)"}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 2. TRAIN ENDPOINT ---
@app.post("/train-model")
def train_brain():
    """Triggers training and reloads the brain"""
    try:
        subprocess.run(["python", "train_model.py"], check=True)
        load_brain() # Reload immediately
        return {"status": "Training Complete. Model Updated."}
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 3. PREDICT ENDPOINT ---
@app.post("/predict", response_model=RiskResponse)
def predict_risk(request: RiskRequest):
    global model, graph_data
    if model is None:
        raise HTTPException(status_code=503, detail="System not ready. Call /generate-data then /train-model first.")
    
    node_id = request.node_id
    if node_id >= graph_data.num_nodes:
        raise HTTPException(status_code=404, detail="User not found.")

    with torch.no_grad():
        out = model(graph_data.x, graph_data.edge_index)
        fraud_risk = float(out[node_id].exp()[1])

    verdict = "SAFE"
    if fraud_risk > 0.8: verdict = "CRITICAL (MULE)"
    elif fraud_risk > 0.5: verdict = "SUSPICIOUS"

    return {
        "node_id": node_id, 
        "risk_score": round(fraud_risk, 4), 
        "verdict": verdict, 
        "model_version": "Gold-v1"
    }