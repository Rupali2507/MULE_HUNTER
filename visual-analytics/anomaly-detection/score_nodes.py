import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHARED_DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "shared-data"))

NODES_FILE = os.path.join(SHARED_DATA_DIR, "nodes.csv")
SCORES_FILE = os.path.join(SHARED_DATA_DIR, "anomaly_scores.csv")
OUTPUT_FILE = os.path.join(SHARED_DATA_DIR, "nodes_scored.csv")

def attach_scores():
    print(" Attaching anomaly scores to nodes...")

    nodes = pd.read_csv(NODES_FILE)
    scores = pd.read_csv(SCORES_FILE)

    df = nodes.merge(scores, on="node_id", how="left")

    df.to_csv(OUTPUT_FILE, index=False)

    print(f" Scored nodes saved → {OUTPUT_FILE}")
    print(df[['node_id', 'anomaly_score', 'is_anomalous']].head())

if __name__ == "__main__":
    attach_scores()
