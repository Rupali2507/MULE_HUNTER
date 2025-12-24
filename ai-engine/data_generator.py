import networkx as nx
import pandas as pd
import random
from faker import Faker
import numpy as np
import os

# --- CONFIGURATION ---
NUM_USERS = 2000
NUM_MULE_RINGS = 50
NUM_CHAINS = 50
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared-data")

# Setup
fake = Faker('en_IN')
Faker.seed(42)
np.random.seed(42)
random.seed(42)

def generate_dataset():
    print(f"Initializing Mule Hunter Simulation...")
    print(f"Output Target: {OUTPUT_DIR}")
    
    # Ensure output directory exists
    if not os.path.exists(OUTPUT_DIR):
        print(f"Folder {OUTPUT_DIR} not found. Creating it...")
        os.makedirs(OUTPUT_DIR)

    # --- STEP 1: Benign Economy (Scale-Free) ---
    print("   Building Scale-Free Network...")
    # We convert to DiGraph (Directed) immediately to preserve money flow direction
    # 'barabasi_albert_graph' creates an undirected graph structure
    G_base = nx.barabasi_albert_graph(n=NUM_USERS, m=2, seed=42)
    G = nx.DiGraph() 
    
    # Copy structure but make edges random directions for background noise
    for u, v in G_base.edges():
        if random.random() > 0.5:
            G.add_edge(u, v)
        else:
            G.add_edge(v, u)

    # Initialize Node Properties
    for i in G.nodes():
        G.nodes[i]['is_fraud'] = 0
        G.nodes[i]['type'] = 'Legit' 
        G.nodes[i]['account_age'] = random.randint(30, 3650)

    # --- STEP 2: Mule Rings (Star Topology) ---
    print(f"Injecting {NUM_MULE_RINGS} Mule Rings...")
    for _ in range(NUM_MULE_RINGS):
        # Pick random nodes
        mule = random.choice(list(G.nodes()))
        criminal = random.choice(list(G.nodes()))
        
        # Label them
        G.nodes[mule]['is_fraud'] = 1
        G.nodes[mule]['type'] = 'Mule'
        G.nodes[criminal]['is_fraud'] = 1
        G.nodes[criminal]['type'] = 'Criminal'
        
        # Fan-Out (Mule -> Criminal)
        G.add_edge(mule, criminal, amount=random.randint(50000, 100000), timestamp=100)
        
        # Fan-In (Victims -> Mule)
        for _ in range(random.randint(10, 20)):
            victim = random.choice(list(G.nodes()))
            if G.nodes[victim]['is_fraud'] == 0:
                G.add_edge(victim, mule, amount=random.randint(500, 2000), timestamp=random.randint(1, 90))

    # --- STEP 3: Laundering Chains (Layering) ---
    print(f"Injecting {NUM_CHAINS} Chains...")
    for _ in range(NUM_CHAINS):
        chain = random.sample(list(G.nodes()), 5)
        for i in range(len(chain) - 1):
            src, dst = chain[i], chain[i+1]
            G.nodes[src]['is_fraud'] = 1
            G.nodes[dst]['is_fraud'] = 1
            G.nodes[src]['type'] = 'Layer'
            # Source -> Target (Direction Preserved by DiGraph)
            G.add_edge(src, dst, amount=50000 - (i*1000), timestamp=100+i)

    # --- STEP 4: Feature Calculation ---
    print("   Calculating Graph Centrality (PageRank)...")
    try:
        pagerank_scores = nx.pagerank(G)
    except ImportError:
        print("   WARNING: Scipy not found. Faking PageRank to prevent crash.")
        pagerank_scores = {n: random.random() for n in G.nodes()}

    # --- STEP 5: Export ---
    print("Saving Data...")
    
    # 5.1 PREPARE NODES
    node_data = []
    for n in G.nodes():
        node_data.append({
            "node_id": str(n),                         # SCHEMA: String (Perfect)
            "is_fraud": int(G.nodes[n]['is_fraud']),   # SCHEMA: Integer 0/1 (Perfect)
            "account_age_days": int(G.nodes[n]['account_age']), # SCHEMA: Number (Perfect)
            "pagerank": float(pagerank_scores.get(n, 0)),     # SCHEMA: Number (Perfect)
            # Generating compliant random stats for the fields we didn't simulate
            "balance": float(round(random.uniform(100.0, 50000.0), 2)),
            "in_out_ratio": float(round(random.uniform(0.1, 2.0), 2)),
            "tx_velocity": int(random.randint(0, 100))
        })
    
    df_nodes = pd.DataFrame(node_data)

    # STRICT SCHEMA FILTER
    required_cols = ["node_id", "account_age_days", "balance", "in_out_ratio", "pagerank", "tx_velocity", "is_fraud"]
    df_nodes = df_nodes[required_cols] # Discard everything else
    
    df_nodes.to_csv(os.path.join(OUTPUT_DIR, "nodes.csv"), index=False)  
    print(f"   Saved nodes.csv ({len(df_nodes)} rows) - STRICT SCHEMA MODE")

    # 5.2 PREPARE TRANSACTIONS
    edge_data = []
    # Because G is DiGraph, u is ALWAYS Source, v is ALWAYS Target. Logic Preserved.
    for u, v, d in G.edges(data=True):
        edge_data.append({
            "source": str(u),
            "target": str(v),
            "amount": float(d.get('amount', random.randint(100, 5000))),
            "timestamp": pd.Timestamp.now().isoformat()
        })
        
    df_edges = pd.DataFrame(edge_data)
    # Ensure Edge Schema Order
    df_edges = df_edges[["source", "target", "amount", "timestamp"]]
    
    df_edges.to_csv(os.path.join(OUTPUT_DIR, "transactions.csv"), index=False)  
    print(f"   Saved transactions.csv ({len(df_edges)} rows)")
    
    print(f"SUCCESS! Data locked in shared-data.")

if __name__ == "__main__":
    generate_dataset()