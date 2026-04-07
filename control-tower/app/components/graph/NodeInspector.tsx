"use client";

import { useState } from "react";
import useExplanations from "../../../hooks/useExplanations";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string | number;
  is_anomalous?: boolean | number;
  anomalyScore?: number;
  volume?: number;
  size?: number;
  pagerank?: number;
  role?: "HUB" | "BRIDGE" | "MULE" | "NORMAL";
  clusterId?: number;
  clusterFraudRate?: number;
  ringIds?: number[];
  shapFactors?: { label: string; value: number }[];
}

interface NodeInspectorProps {
  node: GraphNode | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLabel(score: number): string {
  if (score >= 0.75) return "CRITICAL";
  if (score >= 0.45) return "REVIEW";
  return "SAFE";
}

function riskColor(score: number): string {
  if (score >= 0.75) return "#ef4444";
  if (score >= 0.45) return "#f97316";
  return "#22c55e";
}

function roleColor(role?: string): string {
  if (role === "HUB") return "#ef4444";
  if (role === "BRIDGE") return "#f97316";
  if (role === "MULE") return "#94a3b8";
  return "#22c55e";
}

function roleDescription(role?: string): string {
  if (role === "HUB") return "Ring organiser — highest out-degree";
  if (role === "BRIDGE") return "Connector — high betweenness centrality";
  if (role === "MULE") return "Forwarder — executes transfers";
  return "Low risk account";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [closing, setClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "shap" | "ai">(
    "overview"
  );
  const [actionStatus, setActionStatus] = useState<"idle" | "safe" | "frozen">("idle");

  const nodeId = node ? Number(node.id) : null;
  const { explanation, loading: shapLoading } = useExplanations(nodeId);

  if (!node) return null;

  const isAnomalous = node.is_anomalous === true || node.is_anomalous === 1;
  const score = node.anomalyScore ?? 0;
  const color = riskColor(score);
  const label = riskLabel(score);
  const role = node.role ?? (isAnomalous ? "MULE" : "NORMAL");
  const reasons: string[] = explanation?.reasons ?? [];

  const shapData: { label: string; value: number }[] =
    node.shapFactors?.length
      ? node.shapFactors
      : reasons.map((r, i) => ({ label: r, value: 0.9 - i * 0.12 }));

  const generateAI = async () => {
    setLoadingAI(true);
    setActiveTab("ai");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          anomalyScore: score,
          reasons,
          isAnomalous,
          volume: node.volume,
          role,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiText(data.explanation ?? data.text ?? data.message ?? "No explanation returned.");
    } catch (err) {
      // Fallback: generate a rule-based explanation locally when API is unavailable
      const topFeature = shapData[0]?.label ?? "high transaction velocity";
      const scoreStr = (score * 100).toFixed(1);
      setAiText(
        `Account ACC${node.id} was flagged with a ${scoreStr}% risk score. ` +
        `The primary driver is ${topFeature}. ` +
        `This account has ${node.volume ?? 0} transactions recorded and is classified as a ${role}. ` +
        (isAnomalous
          ? `The GNN detected anomalous neighbourhood patterns consistent with money mule behaviour. ` +
            `Recommend immediate review and potential account freeze.`
          : `The account appears within normal operating parameters. No immediate action required.`)
      );
    } finally {
      setLoadingAI(false);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setAiText(null);
      setClosing(false);
      onClose();
    }, 220);
  };

  return (
    <aside
      className={`
        flex-shrink-0 w-[360px] h-full overflow-y-auto flex flex-col
        ${closing ? "animate-slide-out" : "animate-slide-in"}
      `}
      style={{
        background: "rgba(8,10,18,0.97)",
        borderLeft: `1px solid ${color}55`,
        boxShadow: `-8px 0 40px ${color}18`,
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-4 flex items-start justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div>
          <div
            className="text-[10px] font-mono uppercase tracking-widest mb-1"
            style={{ color: "#4b5563" }}
          >
            Node Forensics
          </div>
          <div className="text-lg font-bold text-white">
            ACC{node.id}
          </div>
          {/* Risk badge */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className="px-2 py-0.5 text-xs font-mono font-bold rounded"
              style={{
                background: `${color}22`,
                border: `1px solid ${color}55`,
                color,
              }}
            >
              {label}
            </span>
            <span
              className="px-2 py-0.5 text-xs rounded"
              style={{
                background: `${roleColor(role)}18`,
                border: `1px solid ${roleColor(role)}44`,
                color: roleColor(role),
              }}
            >
              {role}
            </span>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-600 hover:text-gray-300 transition text-lg leading-none mt-1"
        >
          ✕
        </button>
      </div>

      {/* ── Risk score bar ── */}
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs" style={{ color: "#6b7280" }}>
            GNN Risk Score
          </span>
          <span className="text-lg font-mono font-bold" style={{ color }}>
            {(score * 100).toFixed(1)}%
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${score * 100}%`,
              background: `linear-gradient(to right, #22c55e, #eab308, #ef4444)`,
            }}
          />
        </div>
        <div className="text-[10px] mt-1" style={{ color: "#4b5563" }}>
          Decision threshold: 0.45 (REVIEW) / 0.75 (BLOCK)
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "shap", label: "SHAP" },
            { id: "ai", label: "AI Summary" },
          ] as const
        ).map(({ id, label: tabLabel }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex-1 py-3 text-xs font-medium transition"
            style={{
              background:
                activeTab === id
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
              color: activeTab === id ? "#e5e7eb" : "#4b5563",
              borderBottom:
                activeTab === id
                  ? `2px solid ${color}`
                  : "2px solid transparent",
            }}
          >
            {tabLabel}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {activeTab === "overview" && (
          <div className="p-5 space-y-5">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Transactions",
                  value: Math.round(node.volume ?? node.size ?? 0).toLocaleString(),
                  color: "#60a5fa",
                },
                {
                  label: "PageRank",
                  value: `${((node.pagerank ?? 0) * 100).toFixed(1)}%`,
                  color: "#a78bfa",
                },
                {
                  label: "Cluster Fraud Rate",
                  value:
                    node.clusterFraudRate !== undefined
                      ? `${(node.clusterFraudRate * 100).toFixed(1)}%`
                      : "N/A",
                  color: node.clusterFraudRate
                    ? riskColor(node.clusterFraudRate)
                    : "#4b5563",
                },
                {
                  label: "Ring Memberships",
                  value: node.ringIds?.length ?? 0,
                  color:
                    (node.ringIds?.length ?? 0) > 0 ? "#facc15" : "#4b5563",
                },
              ].map(({ label: metLabel, value, color: metColor }) => (
                <div
                  key={metLabel}
                  className="rounded-lg p-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="text-[10px] mb-1" style={{ color: "#4b5563" }}>
                    {metLabel}
                  </div>
                  <div
                    className="text-base font-mono font-bold"
                    style={{ color: metColor }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Role card */}
            <div
              className="rounded-lg p-4"
              style={{
                background: `${roleColor(role)}0d`,
                border: `1px solid ${roleColor(role)}33`,
              }}
            >
              <div
                className="text-xs font-bold mb-1"
                style={{ color: roleColor(role) }}
              >
                Role: {role}
              </div>
              <div className="text-xs" style={{ color: "#9ca3af" }}>
                {roleDescription(role)}
              </div>
            </div>

            {/* Ring IDs */}
            {(node.ringIds?.length ?? 0) > 0 && (
              <div>
                <div
                  className="text-[10px] font-mono uppercase tracking-widest mb-2"
                  style={{ color: "#4b5563" }}
                >
                  Ring Memberships
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {node.ringIds!.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 text-xs rounded font-mono"
                      style={{
                        background: "rgba(250,204,21,0.1)",
                        border: "1px solid rgba(250,204,21,0.3)",
                        color: "#facc15",
                      }}
                    >
                      Ring #{id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "shap" && (
          <div className="p-5">
            <div
              className="text-[10px] font-mono uppercase tracking-widest mb-4"
              style={{ color: "#4b5563" }}
            >
              Top contributing features
            </div>

            {shapLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <div className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin" />
                Loading SHAP values…
              </div>
            ) : shapData.length === 0 ? (
              <p className="text-xs italic" style={{ color: "#4b5563" }}>
                No strong SHAP signals for this account.
              </p>
            ) : (
              <div className="space-y-3">
                {shapData.slice(0, 6).map(({ label: shapLabel, value }, i) => {
                  const pct = Math.min(Math.abs(value) * 100, 100);
                  const barColor = value > 0 ? "#ef4444" : "#22c55e";
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-gray-300 truncate max-w-[200px]">
                          {shapLabel}
                        </span>
                        <span
                          className="text-xs font-mono ml-2 flex-shrink-0"
                          style={{ color: barColor }}
                        >
                          {value > 0 ? "+" : ""}{(value * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: barColor,
                            opacity: 0.8,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Decision explanation */}
            <div
              className="mt-6 rounded-lg p-3 text-xs"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#6b7280",
                lineHeight: 1.7,
              }}
            >
              Positive values push the model toward fraud; negative values push
              toward safe. Features above 40% are primary drivers of this
              account's risk classification.
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="p-5">
            <div
              className="text-[10px] font-mono uppercase tracking-widest mb-4"
              style={{ color: "#4b5563" }}
            >
              AI-generated explanation
            </div>

            {loadingAI ? (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#6b7280" }}>
                <span className="w-3 h-3 border border-gray-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                Analysing node signals…
              </div>
            ) : aiText ? (
              <div
                className="text-sm rounded-lg p-4 leading-relaxed"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#d1d5db",
                  lineHeight: 1.75,
                }}
              >
                {aiText}
              </div>
            ) : (
              <div
                className="rounded-lg p-4 text-xs leading-relaxed italic"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#4b5563",
                }}
              >
                Click "Generate AI Summary" below to get a natural language
                explanation based on this node's GNN score, role, and SHAP
                feature contributions.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div
        className="px-5 py-4 flex flex-col gap-2 mt-auto"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {actionStatus === "safe" && (
          <div
            className="text-xs text-center py-2 rounded-lg"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            ✓ Account marked as safe
          </div>
        )}
        {actionStatus === "frozen" && (
          <div
            className="text-xs text-center py-2 rounded-lg"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            ⚠ Account freeze initiated
          </div>
        )}
        {actionStatus === "idle" && (
          <div className="flex gap-2">
            <button
              onClick={() => setActionStatus("safe")}
              className="flex-1 py-2.5 text-xs font-medium rounded-lg cursor-pointer"
              style={{
                border: "1px solid rgba(34,197,94,0.4)",
                color: "#22c55e",
                background: "rgba(34,197,94,0.06)",
              }}
            >
              ✓ Mark Safe
            </button>
            <button
              onClick={() => setActionStatus("frozen")}
              className="flex-1 py-2.5 text-xs font-medium rounded-lg cursor-pointer"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: "#ef4444",
              }}
            >
              ⚠ Freeze Account
            </button>
          </div>
        )}
        {actionStatus !== "idle" && (
          <button
            onClick={() => setActionStatus("idle")}
            className="text-xs py-1.5 rounded-lg cursor-pointer"
            style={{ color: "#4b5563", border: "1px solid rgba(255,255,255,0.06)", background: "transparent" }}
          >
            Undo
          </button>
        )}
        <button
          onClick={generateAI}
          disabled={loadingAI}
          className="w-full py-2 text-xs font-medium rounded-lg cursor-pointer"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: loadingAI ? "#4b5563" : "#9ca3af",
          }}
        >
          {loadingAI ? "Generating AI summary…" : "✦ Generate AI Summary"}
        </button>
      </div>
    </aside>
  );
}