"""
MuleHunter AI  ·  GNN Trainer  ·  v5.0
========================================
Architecture: GraphSAGE + GAT Hybrid

  Layer 1 → SAGEConv  (broad neighbourhood aggregation)
  Layer 2 → GATConv   (attention-weighted neighbour selection)
  Layer 3 → SAGEConv  (final aggregation before classification)
  Head    → 3-layer MLP with BatchNorm + Dropout
  Skip    → Residual connection from input → layer-3 output

Loss            : Weighted CrossEntropy (frequency-inverse weights)
Scheduler       : ReduceLROnPlateau (monitors val AUC)
Early stopping  : AUC-based with 150-epoch warm-up, patience=80

"""

from __future__ import annotations

import json
import logging
import os
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from torch_geometric.data import Data
from torch_geometric.nn import BatchNorm, GATConv, SAGEConv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("MuleHunter-Trainer")

# ──────────────────────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR    = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

MODEL_PATH  = SHARED_DATA / "mule_model.pth"
GRAPH_PATH  = SHARED_DATA / "processed_graph.pt"
EVAL_REPORT = SHARED_DATA / "eval_report.json"
MODEL_META  = SHARED_DATA / "model_meta.json"

HIDDEN_CHANNELS = 128
OUT_CHANNELS    = 2
MAX_EPOCHS      = 1000   # hard ceiling; early stopping will fire well before this
WARMUP_EPOCHS   = 150    # no early stopping before this epoch
# Patience in NUMBER OF CHECKS (not epochs). With CHECK_INTERVAL=10 this is
# 300 epochs of no improvement before we give up — survivable on CPU.
PATIENCE_CHECKS = 30
CHECK_INTERVAL  = 10     # evaluate every N epochs (less CPU hammering)


# ──────────────────────────────────────────────────────────────────────────────
# GNN ARCHITECTURE
# ──────────────────────────────────────────────────────────────────────────────

class MuleHunterGNN(torch.nn.Module):
    """
    SAGE → GAT(4 heads) → SAGE with residual skip connection.

    [F6] Dropout reduced to 0.10 on GNN layers and 0.15/0.05 in the
    head. On a 7k-node graph heavy dropout destroys minority-class signal.
    """

    def __init__(
        self,
        in_channels: int,
        hidden: int = HIDDEN_CHANNELS,
        out:    int = OUT_CHANNELS,
    ) -> None:
        super().__init__()

        self.conv1 = SAGEConv(in_channels, hidden)
        self.bn1   = BatchNorm(hidden)

        self.conv2 = GATConv(
            hidden, hidden, heads=4, concat=False,
            dropout=0.10, add_self_loops=False,
        )
        self.bn2 = BatchNorm(hidden)

        self.conv3 = SAGEConv(hidden, hidden // 2)
        self.bn3   = BatchNorm(hidden // 2)

        self.skip = torch.nn.Linear(in_channels, hidden // 2)

        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(hidden // 2, 64),
            torch.nn.BatchNorm1d(64),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.15),
            torch.nn.Linear(64, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.05),
            torch.nn.Linear(32, out),
        )

        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.modules():
            if isinstance(m, torch.nn.Linear):
                torch.nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    torch.nn.init.zeros_(m.bias)

    def forward(
        self,
        x:          torch.Tensor,
        edge_index: torch.Tensor,
        return_embedding: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        identity = self.skip(x)

        x = F.relu(self.bn1(self.conv1(x, edge_index)))
        x = F.dropout(x, p=0.10, training=self.training)

        x = F.relu(self.bn2(self.conv2(x, edge_index)))
        x = F.dropout(x, p=0.10, training=self.training)

        x = F.relu(self.bn3(self.conv3(x, edge_index)))
        embedding = x + identity

        logits = F.log_softmax(self.classifier(embedding), dim=1)
        if return_embedding:
            return logits, embedding
        return logits


# ──────────────────────────────────────────────────────────────────────────────
# EVALUATION
# ──────────────────────────────────────────────────────────────────────────────

def evaluate(
    model:     MuleHunterGNN,
    data:      Data,
    mask:      torch.Tensor,
    threshold: float = 0.5,
) -> dict:
    model.eval()
    with torch.no_grad():
        out  = model(data.x, data.edge_index)
        prob = out[mask].exp()[:, 1].cpu().numpy()
        pred = (prob >= threshold).astype(int)
        true = data.y[mask].cpu().numpy()

    has_both = len(np.unique(true)) > 1
    return {
        "f1":               float(f1_score(true, pred, zero_division=0)),
        "precision":        float(precision_score(true, pred, zero_division=0)),
        "recall":           float(recall_score(true, pred, zero_division=0)),
        "auc_roc":          float(roc_auc_score(true, prob)) if has_both else 0.5,
        "confusion_matrix": confusion_matrix(true, pred).tolist(),
        "threshold_used":   float(threshold),
    }


def find_best_threshold(
    model: MuleHunterGNN,
    data:  Data,
    mask:  torch.Tensor,
) -> tuple[float, float]:
    """Return (threshold, f1) that maximises F1 on the given mask."""
    model.eval()
    with torch.no_grad():
        out  = model(data.x, data.edge_index)
        prob = out[mask].exp()[:, 1].cpu().numpy()
        true = data.y[mask].cpu().numpy()

    if len(np.unique(true)) < 2:
        return 0.5, 0.0

    prec, rec, thresholds = precision_recall_curve(true, prob)
    denom     = prec[:-1] + rec[:-1]
    f1_scores = np.where(denom > 0, 2.0 * prec[:-1] * rec[:-1] / denom, 0.0)

    if f1_scores.max() == 0.0:
        logger.warning("  No threshold yields F1 > 0 — defaulting to 0.5")
        return 0.5, 0.0

    best_idx    = int(f1_scores.argmax())
    best_thresh = float(np.clip(thresholds[best_idx], 0.01, 0.99))
    best_f1     = float(f1_scores[best_idx])
    logger.info("  Optimal threshold: %.4f  (val F1=%.4f)", best_thresh, best_f1)
    return best_thresh, best_f1


# ──────────────────────────────────────────────────────────────────────────────
# TRAINING
# ──────────────────────────────────────────────────────────────────────────────

def train() -> None:
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)
    torch.backends.cudnn.deterministic = True

    logger.info("=" * 65)
    logger.info("MuleHunter GNN Trainer v5.0")
    logger.info("=" * 65)

    if not GRAPH_PATH.exists():
        raise FileNotFoundError(
            f"Graph not found at {GRAPH_PATH}. Run feature_engineering.py first."
        )

    data = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)

    n_fraud = int(data.y.sum())
    n_total = int(data.y.shape[0])
    n_safe  = n_total - n_fraud
    logger.info(
        "  Nodes: %s | Edges: %s | Features: %d",
        f"{n_total:,}", f"{data.edge_index.shape[1]:,}", data.x.shape[1],
    )
    logger.info(
        "  Class balance → safe: %s | fraud: %s (%.1f%%)",
        f"{n_safe:,}", f"{n_fraud:,}", 100.0 * n_fraud / n_total,
    )

    in_channels = data.x.shape[1]
    device      = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("  Device: %s", device)

    data  = data.to(device)
    model = MuleHunterGNN(in_channels=in_channels).to(device)

    # ── [F3/F4] Weighted CrossEntropy — weights from training split only ───────
    train_labels = data.y[data.train_mask]
    n_tr_pos     = int((train_labels == 1).sum())
    n_tr_neg     = int((train_labels == 0).sum())
    n_tr_total   = n_tr_pos + n_tr_neg

    # w_i = n_total / (n_classes * n_class_i)  — sklearn convention
    w_neg = n_tr_total / (2.0 * n_tr_neg)
    w_pos = n_tr_total / (2.0 * n_tr_pos)
    class_weights = torch.tensor([w_neg, w_pos], dtype=torch.float, device=device)

    logger.info(
        "  Training split → safe: %d | fraud: %d | w_safe=%.3f | w_fraud=%.3f",
        n_tr_neg, n_tr_pos, w_neg, w_pos,
    )

    # NLLLoss works with log-softmax outputs (what the model returns)
    criterion = torch.nn.NLLLoss(weight=class_weights)

    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)

    # ReduceLROnPlateau: patience=40 checks = 400 epochs of stagnation before
    # halving LR.  Previous value of 20 caused LR to collapse inside warmup.
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="max", factor=0.5, patience=40,
        min_lr=1e-6, verbose=False,
    )

    # ── Training loop ─────────────────────────────────────────────────────────
    best_val_auc      = 0.0
    best_val_f1       = 0.0
    checks_no_improve = 0   # counts CHECK events with no improvement (not epochs)
    history: list[dict] = []

    header = (
        f"{'Epoch':>6} | {'Loss':>8} | {'ValAUC':>8} | "
        f"{'Val F1':>8} | {'Prec':>7} | {'Rec':>7} | {'LR':>9}"
    )
    logger.info("\n%s\n%s", header, "─" * len(header))

    for epoch in range(1, MAX_EPOCHS + 1):

        # [F7] LR warm-up: scale LR linearly for first 20 epochs
        if epoch <= 20:
            warmup_factor = epoch / 20.0
            for pg in optimizer.param_groups:
                pg["lr"] = 1e-3 * warmup_factor

        model.train()
        optimizer.zero_grad()
        out  = model(data.x, data.edge_index)
        loss = criterion(out[data.train_mask], data.y[data.train_mask])
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        if epoch % CHECK_INTERVAL == 0:
            val_m   = evaluate(model, data, data.val_mask)
            cur_lr  = optimizer.param_groups[0]["lr"]
            history.append({"epoch": epoch, "loss": float(loss), "lr": cur_lr, **val_m})

            logger.info(
                "%6d | %8.4f | %8.4f | %8.4f | %7.4f | %7.4f | %9.2e",
                epoch, float(loss),
                val_m["auc_roc"], val_m["f1"],
                val_m["precision"], val_m["recall"],
                cur_lr,
            )

            # [F8] Feed AUC into plateau scheduler (only after warmup)
            if epoch > 20:
                scheduler.step(val_m["auc_roc"])

            # Track best AUC; save checkpoint
            if val_m["auc_roc"] > best_val_auc:
                best_val_auc      = val_m["auc_roc"]
                best_val_f1       = val_m["f1"]
                checks_no_improve = 0          # reset on any improvement
                torch.save(model.state_dict(), MODEL_PATH)
                logger.info(
                    "  ✓ Best AUC=%.4f  F1=%.4f  (prec=%.4f rec=%.4f) — saved",
                    best_val_auc, best_val_f1,
                    val_m["precision"], val_m["recall"],
                )
            else:
                # Only count towards patience AFTER warm-up period is done.
                # Bug was: counter incremented during warmup so early stopping
                # fired immediately after warmup ended.
                if epoch > WARMUP_EPOCHS:
                    checks_no_improve += 1
                    if checks_no_improve >= PATIENCE_CHECKS:
                        logger.info(
                            "  Early stopping at epoch %d  "
                            "(no AUC improvement for %d checks = %d epochs)",
                            epoch, PATIENCE_CHECKS, PATIENCE_CHECKS * CHECK_INTERVAL,
                        )
                        break

    # ── Final evaluation ──────────────────────────────────────────────────────
    logger.info("\nLoading best checkpoint for final test evaluation...")
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))

    best_thresh, _ = find_best_threshold(model, data, data.val_mask)

    test_metrics    = evaluate(model, data, data.test_mask, threshold=best_thresh)
    val_metrics_fin = evaluate(model, data, data.val_mask,  threshold=best_thresh)
    test_default    = evaluate(model, data, data.test_mask, threshold=0.5)

    logger.info("\n%s", "=" * 65)
    logger.info("FINAL EVALUATION REPORT")
    logger.info("=" * 65)
    for k, v in test_metrics.items():
        if k not in ("confusion_matrix", "threshold_used"):
            logger.info("  Test %-20s: %.4f", k.upper(), v)
    logger.info("  Threshold used           : %.4f  (tuned on val set)", best_thresh)
    logger.info(
        "  Default-0.5 F1           : %.4f  ← tuned F1: %.4f",
        test_default["f1"], test_metrics["f1"],
    )
    logger.info("  Best val AUC (training)  : %.4f", best_val_auc)

    cm = np.array(test_metrics["confusion_matrix"])
    logger.info(
        "\n  Confusion Matrix:\n"
        "    TN=%6d  FP=%6d\n"
        "    FN=%6d  TP=%6d",
        cm[0, 0], cm[0, 1], cm[1, 0], cm[1, 1],
    )

    # ── Save artifacts ────────────────────────────────────────────────────────
    report = {
        "test":                   test_metrics,
        "val":                    val_metrics_fin,
        "test_default_threshold": test_default,
        "best_val_auc":           best_val_auc,
        "best_val_f1":            best_val_f1,
        "optimal_threshold":      best_thresh,
        "training_history":       history,
        "model_config": {
            "in_channels":     in_channels,
            "hidden_channels": HIDDEN_CHANNELS,
            "architecture":    "SAGE→GAT(4heads)→SAGE + Residual",
            "loss":            f"WeightedNLLLoss(w_safe={w_neg:.3f}, w_fraud={w_pos:.3f})",
            "optimizer":       "AdamW(lr=1e-3→ReduceLROnPlateau, wd=1e-4)",
            "class_counts":    {"safe": n_tr_neg, "fraud": n_tr_pos},
            "warmup_epochs":   WARMUP_EPOCHS,
            "patience_checks": PATIENCE_CHECKS,
            "patience_epochs": PATIENCE_CHECKS * CHECK_INTERVAL,
        },
    }
    with open(EVAL_REPORT, "w") as f:
        json.dump(report, f, indent=2)

    meta = {
        "version":           "MuleHunter-V5",
        "in_channels":       in_channels,
        "hidden_channels":   HIDDEN_CHANNELS,
        "test_f1":           test_metrics["f1"],
        "test_auc":          test_metrics["auc_roc"],
        "test_precision":    test_metrics["precision"],
        "test_recall":       test_metrics["recall"],
        "optimal_threshold": best_thresh,
    }
    with open(MODEL_META, "w") as f:
        json.dump(meta, f, indent=2)

    logger.info("\nModel  → %s", MODEL_PATH)
    logger.info("Report → %s", EVAL_REPORT)
    logger.info("TRAINING COMPLETE — MuleHunter V5")


if __name__ == "__main__":
    train()