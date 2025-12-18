import useExplanations from "../hooks/useExplanations";

export default function NodeInspector({ node }) {
  const explanations = useExplanations();

  if (!node) {
    return (
      <div className="p-6 text-gray-400">
        Click on a node to inspect account details
      </div>
    );
  }

  const rawReasons = explanations[node.id];
  const reasons = Array.isArray(rawReasons) ? rawReasons : [];

  return (
    <div className="h-full p-6 space-y-6 bg-black">
      <div>
        <h2 className="text-lg font-semibold text-white">Account #{node.id}</h2>
        <p
          className={`text-sm ${
            node.is_anomalous ? "text-red-400" : "text-green-400"
          }`}
        >
          {node.is_anomalous ? "High Risk / Suspicious" : "Normal Account"}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Metric
          label="Total Transactions"
          value={node.in_degree + node.out_degree}
        />
        <Metric label="Incoming Tx" value={node.in_degree} />
        <Metric label="Outgoing Tx" value={node.out_degree} />
        <Metric
          label="Anomaly Score"
          value={node.height.toFixed(2)}
          highlight={node.is_anomalous}
        />
      </div>

      {/* Explanation */}
      {node.is_anomalous && (
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-2">
            Why flagged?
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className="rounded-lg border border-gray-800 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-lg ${highlight ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}
