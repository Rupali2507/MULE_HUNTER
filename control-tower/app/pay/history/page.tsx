"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TxRecord {
  id: string;
  receiverName: string;
  amount: number;
  decision: "APPROVE" | "REVIEW" | "BLOCK";
  finalRisk: number;
  timestamp: string;
}

const STATUS_STYLES = {
  APPROVE: "text-emerald-400 bg-emerald-950/50 border-emerald-700/40",
  REVIEW: "text-amber-400 bg-amber-950/50 border-amber-700/40",
  BLOCK: "text-red-400 bg-red-950/50 border-red-700/40",
};

const STATUS_LABELS = {
  APPROVE: "Approved",
  REVIEW: "Under Review",
  BLOCK: "Blocked",
};

// Mock history - in production this would come from MongoDB via API
const MOCK_HISTORY: TxRecord[] = [
  {
    id: "a1b2c3d4",
    receiverName: "Ananya Krishnan",
    amount: 2500,
    decision: "APPROVE",
    finalRisk: 0.18,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "e5f6g7h8",
    receiverName: "Suresh Patel",
    amount: 800,
    decision: "REVIEW",
    finalRisk: 0.58,
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "i9j0k1l2",
    receiverName: "Meera Nair",
    amount: 15000,
    decision: "BLOCK",
    finalRisk: 0.87,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "m3n4o5p6",
    receiverName: "Arjun Sharma",
    amount: 500,
    decision: "APPROVE",
    finalRisk: 0.12,
    timestamp: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function HistoryPage() {
  const [history, setHistory] = useState<TxRecord[]>([]);

  useEffect(() => {
    // Load from session storage (set by gateway on result) + mock data
    try {
      const stored = sessionStorage.getItem("mh_tx_history");
      const parsed: TxRecord[] = stored ? JSON.parse(stored) : [];
      setHistory([...parsed, ...MOCK_HISTORY]);
    } catch {
      setHistory(MOCK_HISTORY);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70 sticky top-0 bg-slate-950/90 backdrop-blur-sm">
        <Link
          href="/pay"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm">Back</span>
        </Link>
        <h1 className="text-white font-semibold">Transaction History</h1>
        <div className="w-16" />
      </header>

      <main className="max-w-md mx-auto px-5 py-6 space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-600 text-4xl mb-4">📭</p>
            <p className="text-slate-400">No transactions yet</p>
            <Link href="/pay" className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-300">
              Make your first payment →
            </Link>
          </div>
        ) : (
          history.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40"
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                  tx.decision === "APPROVE"
                    ? "bg-emerald-950/60"
                    : tx.decision === "REVIEW"
                    ? "bg-amber-950/60"
                    : "bg-red-950/60"
                }`}
              >
                {tx.decision === "APPROVE" ? "✓" : tx.decision === "REVIEW" ? "⏱" : "🛡"}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{tx.receiverName}</p>
                <p className="text-slate-500 text-xs">
                  {new Date(tx.timestamp).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* Amount + Status */}
              <div className="text-right shrink-0">
                <p className="text-white font-semibold">
                  ₹{tx.amount.toLocaleString("en-IN")}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[tx.decision]}`}
                >
                  {STATUS_LABELS[tx.decision]}
                </span>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}
