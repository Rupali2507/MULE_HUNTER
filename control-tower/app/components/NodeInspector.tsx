"use client";
import React, { useState } from "react";

interface NodeData {
  node_id: number;
  is_anomalous: number;
  anomaly_score: number;
  risk_ratio: number;
  account_age_days: number;
  tx_velocity: string | number;
  degree?: number;
  reasons?: string[];
}

interface NodeInspectorProps {
  node: NodeData | null;
  loading: boolean;
  onClose: () => void;
}

export default function NodeInspector({ node, loading, onClose }: NodeInspectorProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSlide, setActiveSlide] = useState<"shap" | "ai">("shap");

  if (loading) {
    return (
      <aside className="fixed right-0 top-0 z-100 w-96 h-screen bg-zinc-900 border-l border-zinc-800 p-10 flex items-center justify-center">
        <div className="text-lime-500 font-mono animate-pulse">LOADING FORENSICS...</div>
      </aside>
    );
  }

  if (!node) return null;

  const isAnomalous = node.is_anomalous === 1;
  const reasons = node.reasons || [];

  const generateAIExplanation = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setAiText(
        `Account ${node.node_id} flagged for ${reasons[0] || 'unusual activity'}. 
        Model detected high risk ratio (${node.risk_ratio}) and rapid transaction velocity.`
      );
      setIsGenerating(false);
    }, 1000);
  };

  return (
    <aside className={`fixed right-0 top-0 z-100 w-96 h-screen overflow-y-auto animate-slide-in bg-zinc-900 text-white border-l 
      ${isAnomalous ? "border-red-600 shadow-[-10px_0_20px_rgba(239,68,68,0.2)]" : "border-green-600 shadow-[-10px_0_20px_rgba(34,197,94,0.2)]"}`}>
      
      <div className="flex justify-between items-center p-5 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">
          Forensics: <span className={isAnomalous ? "text-red-400" : "text-green-400"}>ACC{node.node_id}</span>
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white cursor-pointer">✕</button>
      </div>

      <Section title="Account Summary">
        <Metric label="Risk Status" value={isAnomalous ? "Anomalous" : "Normal"} highlight={isAnomalous} color={isAnomalous ? "red" : "green"} />
        <Metric label="Risk Score" value={(Number(node.anomaly_score) * 100).toFixed(1) + "%"} />
        <Metric label="Risk Ratio" value={Number(node.risk_ratio).toFixed(2)} />
      </Section>

      <Section title="Network Metrics">
        <Metric label="Account Age" value={`${node.account_age_days} days`} />
        <Metric label="Tx Velocity" value={String(node.tx_velocity)} />
        <Metric label="Connectivity" value={String(node.degree || "High")} />
      </Section>

      <Section title="Explainability">
        <div className="flex mb-4 rounded-md overflow-hidden border border-zinc-700">
          <button onClick={() => setActiveSlide("shap")} className={`flex-1 py-2 text-[10px] font-bold uppercase ${activeSlide === 'shap' ? 'bg-zinc-800' : 'bg-zinc-900 text-gray-500'}`}>SHAP Signals</button>
          <button onClick={() => setActiveSlide("ai")} className={`flex-1 py-2 text-[10px] font-bold uppercase ${activeSlide === 'ai' ? 'bg-zinc-800' : 'bg-zinc-900 text-gray-500'}`}>AI Summary</button>
        </div>

        <div className="min-h-35">
          {activeSlide === "shap" ? (
            <ul className="space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className={`p-2 rounded text-xs ${isAnomalous ? 'bg-red-950/40 text-red-200' : 'bg-green-950/40 text-green-200'}`}>▸ {r}</li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 italic leading-relaxed">{aiText || "Click to generate LLM forensic summary..."}</p>
              <button onClick={generateAIExplanation} disabled={isGenerating} className="w-full bg-white text-black text-xs py-2 rounded font-bold hover:bg-gray-200 transition-colors">
                {isGenerating ? "Processing..." : "Generate AI Summary"}
              </button>
            </div>
          )}
        </div>
      </Section>

      <div className="flex gap-3 p-5 mt-auto">
        <button className="flex-1 border border-green-500 text-green-400 py-2 rounded text-xs font-bold hover:bg-green-500/10">White-list</button>
        <button className="flex-1 bg-red-600 text-white py-2 rounded text-xs font-bold hover:bg-red-700">Freeze Account</button>
      </div>
    </aside>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="p-5 border-b border-zinc-800">
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</h3>
      {children}
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: "red" | "green";
}

function Metric({ label, value, highlight, color }: MetricProps) {
  const colorClass = color === "red" ? "text-red-400" : color === "green" ? "text-green-400" : "text-white";
  return (
    <div className="flex justify-between text-xs mb-2">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className={`${highlight ? "font-bold" : ""} ${colorClass}`}>{value}</span>
    </div>
  );
}