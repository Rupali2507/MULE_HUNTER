import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SHARED_DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "shared-data"))

INPUT_FILE = os.path.join(SHARED_DATA_DIR, "nodes_scored.csv")
OUTPUT_FILE = os.path.join(SHARED_DATA_DIR, "nodes_viz.json")

def prepare_viz_data():
    df = pd.read_csv(INPUT_FILE)

    df["color"] = df["anomaly_score"].apply(
        lambda x: "red" if x > 0 else "green"
    )

    df["size"] = (df["total_incoming"] + df["total_outgoing"]) ** 0.5
    df["height"] = df["anomaly_score"] * 10

    viz_df = df[[
        "node_id",
        "color",
        "size",
        "height",
        "is_anomalous"
    ]]

    viz_df.to_json(OUTPUT_FILE, orient="records")
    print(f" Visualization data ready → {OUTPUT_FILE}")

if __name__ == "__main__":
    prepare_viz_data()
