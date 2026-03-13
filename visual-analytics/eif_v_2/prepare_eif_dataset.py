import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "shared-data" / "nodes.csv"

df = pd.read_csv(DATA_PATH)

# -----------------------------
# Generate EIF features
# -----------------------------

df["velocity_score"] = df["tx_velocity_7d"]

df["burst_score"] = df["amount_entropy"]

df["suspicious_neighbor_count"] = (
    df["fan_out_ratio"] * 10
).clip(0, 10)

df["ja3_reuse_count"] = np.random.randint(0, 5, len(df))

df["device_reuse_count"] = (
    (1 - df["device_consistency"]) * 5
).clip(0, 5)

df["ip_reuse_count"] = np.random.randint(0, 4, len(df))

# Final dataset used for EIF
FEATURE_NAMES = [
    "velocity_score",
    "burst_score",
    "suspicious_neighbor_count",
    "ja3_reuse_count",
    "device_reuse_count",
    "ip_reuse_count"
]

eif_df = df[FEATURE_NAMES]

OUT_PATH = BASE_DIR / "shared-data" / "eif_features.csv"
eif_df.to_csv(OUT_PATH, index=False)

print("✅ EIF dataset created:", OUT_PATH)
print(eif_df.head())