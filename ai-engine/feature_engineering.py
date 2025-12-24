import pandas as pd
import networkx as nx
import torch
import os
import numpy as np
from torch_geometric.data import Data

# CONFIG
# Defines the relative path to the shared data directory
SHARED_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared-data")

def build_graph_data():
    print("Starting Feature Engineering & Data Enrichment...")
    
    # 1. Load the raw data
    nodes_path = os.path.join(SHARED_DATA_DIR, "nodes.csv")
    tx_path = os.path.join(SHARED_DATA_DIR, "transactions.csv")
    
    if not os.path.exists(nodes_path) or not os.path.exists(tx_path):
        raise FileNotFoundError("❌ Data files not found. Run data_generator.py first.")

    df_nodes = pd.read_csv(nodes_path)
    df_tx = pd.read_csv(tx_path)

    # 2. Build Graph for Metric Calculation
    print("   Building internal graph structure...")
    G = nx.DiGraph()
    G.add_nodes_from(df_nodes['node_id'])
    
    # Add edges with attributes
    for _, row in df_tx.iterrows():
        G.add_edge(row['source'], row['target'], amount=row['amount'], timestamp=row['timestamp'])

    # 3. CALCULATE FEATURES
    print("   Calculating node-level feature statistics...")
    
    # Lists to store enriched data for the CSV export
    in_degrees = []
    out_degrees = []
    total_in_amounts = []
    total_out_amounts = []
    ratios = []
    
    # List to store features for the AI Tensor
    ai_features = []
    labels = []
    
    for node_id in df_nodes['node_id']:
        # -- Feature A: Degree Metrics --
        d_in = G.in_degree(node_id)
        d_out = G.out_degree(node_id)
        
        # -- Feature B: Money Flow Metrics --
        in_edges = G.in_edges(node_id, data=True)
        out_edges = G.out_edges(node_id, data=True)
        
        # safely extract 'amount', defaulting to 0 if missing
        amt_in = sum([d.get('amount', 0) for _, _, d in in_edges])
        amt_out = sum([d.get('amount', 0) for _, _, d in out_edges])
        
        # -- Feature C: Flow Ratio --
        # Add epsilon (1e-5) to denominator to avoid division by zero errors
        ratio = amt_in / (amt_out + 1e-5)
        
        # Append to CSV lists
        in_degrees.append(d_in)
        out_degrees.append(d_out)
        total_in_amounts.append(amt_in)
        total_out_amounts.append(amt_out)
        ratios.append(ratio)
        
        # Append to AI Tensor lists (Scaling amounts by 10,000 for normalization)
        ai_features.append([d_in, d_out, amt_in/10000.0, amt_out/10000.0, ratio])
        
        # Retrieve Ground Truth Label
        label = df_nodes.loc[df_nodes['node_id'] == node_id, 'is_fraud'].values[0]
        labels.append(label)

    # 4. EXPORT ENRICHED CSV (For Dashboard/Visualization)
    print("Saving enriched CSV for dashboard integration...")
    df_nodes['in_degree'] = in_degrees
    df_nodes['out_degree'] = out_degrees
    df_nodes['total_incoming'] = total_in_amounts
    df_nodes['total_outgoing'] = total_out_amounts
    df_nodes['risk_ratio'] = ratios
    
    # Overwrite the existing nodes.csv with the enriched version
    df_nodes.to_csv(nodes_path, index=False)
    print(f"      -> Updated {nodes_path} with calculated metrics.")

    # 5. EXPORT PYTORCH TENSOR (For AI Model)
    print("   💾 Saving Tensor for Graph Neural Network...")
    x = torch.tensor(ai_features, dtype=torch.float)
    y = torch.tensor(labels, dtype=torch.long)
    sources = df_tx['source'].values
    targets = df_tx['target'].values
    edge_index = torch.tensor([sources, targets], dtype=torch.long)

    data = Data(x=x, edge_index=edge_index, y=y)
    torch.save(data, os.path.join(SHARED_DATA_DIR, "processed_graph.pt")) # This line should be changed. Instead of storing output data locally, it should call an api which send data into database.
    
    print(" SUCCESS! Feature engineering and data enrichment complete.")

if __name__ == "__main__":
    build_graph_data()