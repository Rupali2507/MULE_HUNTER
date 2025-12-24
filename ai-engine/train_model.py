import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv
from torch_geometric.data import Data
import os
import numpy as np

# --- CONFIGURATION ---
# Use the same relative path logic as the API so it works in Docker
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHARED_DATA_DIR = os.path.join(BASE_DIR, "..", "shared-data")

NODES_PATH = os.path.join(SHARED_DATA_DIR, "nodes.csv")
EDGES_PATH = os.path.join(SHARED_DATA_DIR, "transactions.csv")
MODEL_SAVE_PATH = os.path.join(SHARED_DATA_DIR, "mule_model.pth")
DATA_SAVE_PATH = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")

# --- DEFINING THE GNN (Must match inference_service.py exactly) ---
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

def train():
    print("🚀 Starting Training Pipeline...")

    # 1. Load Data
    if not os.path.exists(NODES_PATH) or not os.path.exists(EDGES_PATH):
        raise FileNotFoundError("❌ Data not found! Run POST /generate-data first.")

    print("   Loading CSVs...")
    df_nodes = pd.read_csv(NODES_PATH)
    df_edges = pd.read_csv(EDGES_PATH)

    # 2. Prepare Graph Data
    # Align Node IDs (Map String IDs to Index 0..N)
    # We need a mapping because PyTorch Geometric needs integer indices
    node_mapping = {id: idx for idx, id in enumerate(df_nodes['node_id'].astype(str))}
    
    # Create Edge Index (Source -> Target)
    src = df_edges['source'].astype(str).map(node_mapping).values
    dst = df_edges['target'].astype(str).map(node_mapping).values
    
    # Filter out edges where nodes might be missing (safety check)
    mask = ~np.isnan(src) & ~np.isnan(dst)
    edge_index = torch.tensor([src[mask], dst[mask]], dtype=torch.long)

    # 3. Create Features (x)
    feature_cols = ["account_age_days", "balance", "in_out_ratio", "pagerank", "tx_velocity"]
    x = torch.tensor(df_nodes[feature_cols].values, dtype=torch.float)

    # 4. Create Labels (y)
    y = torch.tensor(df_nodes['is_fraud'].values, dtype=torch.long)

    # Pack it into a PyG Data Object
    graph_data = Data(x=x, edge_index=edge_index, y=y)
    
    # SAVE THE GRAPH DATA (So inference can load it later)
    torch.save(graph_data, DATA_SAVE_PATH)
    print(f"Processed Graph saved to {DATA_SAVE_PATH}")

    # 5. Initialize Model
    # Input features = 5 (account_age, balance, ratio, pagerank, velocity)
    model = MuleSAGE(in_channels=5, hidden_channels=16, out_channels=2)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

    # 6. Training Loop
    model.train()
    print("   Training GNN (This may take a moment)...")
    for epoch in range(100): # 100 Epochs is enough for demo
        optimizer.zero_grad()
        out = model(graph_data.x, graph_data.edge_index)
        loss = F.nll_loss(out, graph_data.y)
        loss.backward()
        optimizer.step()
        
        if epoch % 10 == 0:
            print(f"   Epoch {epoch}: Loss {loss.item():.4f}")

    # 7. Save Model
    torch.save(model.state_dict(), MODEL_SAVE_PATH)
    print(f"🎉 Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train()