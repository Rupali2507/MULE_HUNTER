import pandas as pd
import networkx as nx
import torch
import os
import numpy as np
from torch_geometric.data import Data

# CONFIG
SHARED_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared-data")

def build_graph_data():
    print("🧠 Starting Feature Engineering...")
    
    # 1. Load the raw data
    nodes_path = os.path.join(SHARED_DATA_DIR, "nodes.csv")
    tx_path = os.path.join(SHARED_DATA_DIR, "transactions.csv")
    
    if not os.path.exists(nodes_path) or not os.path.exists(tx_path):
        raise FileNotFoundError("❌ Run data_generator.py first!")

    df_nodes = pd.read_csv(nodes_path)
    df_tx = pd.read_csv(tx_path)

    # 2. Create a NetworkX graph to calculate metrics easily
    print("   Building internal graph for metric calculation...")
    G = nx.DiGraph() # Directed Graph (Money flows A -> B)
    G.add_nodes_from(df_nodes['node_id'])
    
    # Add edges with attributes
    for _, row in df_tx.iterrows():
        G.add_edge(row['source'], row['target'], amount=row['amount'], timestamp=row['timestamp'])

    # 3. ENGINEERING THE FEATURES (The "Clues")
    print("   Calculating Mule Signals (In/Out Ratios, Velocity)...")
    
    features = []
    labels = []
    
    for node_id in df_nodes['node_id']:
        # -- Feature A: Degree (How connected are they?) --
        in_degree = G.in_degree(node_id)
        out_degree = G.out_degree(node_id)
        
        # -- Feature B: Money Flow (The "Pass-Through" Check) --
        # Sum of money coming in vs going out
        in_edges = G.in_edges(node_id, data='amount')
        out_edges = G.out_edges(node_id, data='amount')
        
        total_in = sum([d for _, _, d in in_edges])
        total_out = sum([d for _, _, d in out_edges])
        
        # Avoid division by zero
        ratio = total_in / (total_out + 1e-5)
        
        # -- Feature C: Neighbor Trust (Are neighbors fraud?) --
        # (In real life we wouldn't know this, but we use 'Account Age' as a proxy)
        # We'll just stick to structural features for now.
        
        # Append [In_Degree, Out_Degree, Total_In, Total_Out, Ratio]
        # We normalize (scale) these numbers later so big numbers don't break the AI
        features.append([in_degree, out_degree, total_in, total_out, ratio])
        
        # Get the label (0 = Safe, 1 = Fraud)
        label = df_nodes.loc[df_nodes['node_id'] == node_id, 'is_fraud'].values[0]
        labels.append(label)

    # 4. Convert to PyTorch Tensors (The format AI understands)
    print("   Converting to PyTorch Geometric format...")
    
    # x = The Features (Matrix of clues)
    x = torch.tensor(features, dtype=torch.float)
    
    # y = The Answers (0 or 1)
    y = torch.tensor(labels, dtype=torch.long)
    
    # edge_index = The Graph Connections (Who connects to whom)
    # PyG needs 2 rows: [Source_Nodes, Target_Nodes]
    sources = df_tx['source'].values
    targets = df_tx['target'].values
    edge_index = torch.tensor([sources, targets], dtype=torch.long)

    # 5. Create the Data Object
    data = Data(x=x, edge_index=edge_index, y=y)
    
    # 6. Save it
    output_file = os.path.join(SHARED_DATA_DIR, "processed_graph.pt")
    torch.save(data, output_file)
    print(f"✅ SUCCESS! Processed graph saved to: {output_file}")
    print(f"   - Nodes: {data.num_nodes}")
    print(f"   - Features per node: {data.num_features}")
    print(f"   - Fraud Cases: {data.y.sum().item()}")

if __name__ == "__main__":
    build_graph_data()
    