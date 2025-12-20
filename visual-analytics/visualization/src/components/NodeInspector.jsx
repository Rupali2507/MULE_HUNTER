import { useState } from "react";

export default function NodeInspector({ node, explanations, onClose }) {
  const [aiText, setAiText] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!node) return null;

  const reasons = explanations?.[node.id] || [];

  const generateAIExplanation = async () => {
    setLoading(true);

    // 🔮 For hackathon/demo: mock AI
    setTimeout(() => {
      setAiText(
        `Account ${node.id} shows unusual transaction behavior with high connectivity 
to anomalous accounts. Rapid inflow and outflow patterns indicate potential mule activity.`
      );
      setLoading(false);
    }, 1200);
  };

  return (
    <aside className="w-[380px] h-full bg-zinc-900 border-l border-zinc-800 overflow-y-auto animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <h2 className="text-lg font-semibold">
          Node Forensics: <span className="text-red-400">ACC{node.id}</span>
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {/* Account Summary */}
      <Section title="Account Summary">
        <Metric
          label="Risk Status"
          value={node.is_anomalous ? "Anomalous" : "Normal"}
          highlight
        />
        <Metric
          label="Risk Score"
          value={Math.abs(node.height * 10).toFixed(0)}
        />
      </Section>

      {/* Metrics */}
      <Section title="Metrics">
        <Metric label="Total Transactions" value={node.total_tx || "—"} />
        <Metric label="Suspicious vs Normal" value="40 / 160" />
        <Metric label="Connectivity Score" value="92" />
      </Section>

      {/* Explainability */}
      <Section title="AI Explainability">
        <p className="text-sm text-gray-400 mb-3">
          Why was this account flagged?
        </p>

        {reasons.length > 0 && (
          <ul className="mb-3 list-disc pl-4 text-sm text-gray-300 space-y-1">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        {aiText && (
          <div className="bg-zinc-800 p-3 rounded-md text-sm text-gray-200 mb-3">
            {aiText}
          </div>
        )}

        <button
          onClick={generateAIExplanation}
          disabled={loading}
          className="w-full rounded-md bg-white text-black py-2 text-sm font-medium hover:bg-gray-200"
        >
          {loading ? "Generating..." : "Generate AI Summary"}
        </button>
      </Section>

      {/* Actions */}
      <div className="flex gap-3 p-5">
        <button className="flex-1 rounded-md border border-green-500 text-green-400 py-2">
          Mark as Safe
        </button>
        <button className="flex-1 rounded-md bg-red-600 py-2">
          Initiate Freeze
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <div className="p-5 border-b border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className="flex justify-between text-sm mb-2">
      <span className="text-gray-400">{label}</span>
      <span className={highlight ? "text-red-400 font-semibold" : ""}>
        {value}
      </span>
    </div>
  );
}
