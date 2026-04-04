"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/hooks/useRole";

interface TransactionResult {
  decision: "APPROVE" | "REVIEW" | "BLOCK";
  finalRisk: number;
  transactionId: string;
  amount: number;
  receiverName: string;
  gnnScore?: number;
  eifScore?: number;
  behaviorScore?: number;
  blockchainHash?: string;
  riskFactors?: string[];
  ringMembership?: { isMuleRingMember: boolean; ringShape?: string; role?: string };
}

interface ResultScreenProps {
  result: TransactionResult;
  onDone: () => void;
}

function ConfettiParticle({ index }: { index: number }) {
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#fbbf24", "#f59e0b"];
  const color = colors[index % colors.length];
  const left = `${5 + (index * 6.5) % 90}%`;
  const delay = `${(index * 0.08).toFixed(2)}s`;
  const size = 6 + (index % 4) * 2;

  return (
    <div
      className="absolute top-0 animate-bounce pointer-events-none"
      style={{
        left,
        animationDelay: delay,
        animationDuration: `${0.8 + (index % 5) * 0.2}s`,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: index % 3 === 0 ? "50%" : "2px",
          transform: `rotate(${index * 45}deg)`,
        }}
      />
    </div>
  );
}

export function ResultScreen({ result, onDone }: ResultScreenProps) {
  const { role } = useRole();
  const [showAnalysisLink, setShowAnalysisLink] = useState(false);
  const [countdown, setCountdown] = useState(86400); // 24h in seconds (cosmetic)

  useEffect(() => {
    setTimeout(() => setShowAnalysisLink(true), 800);
  }, []);

  useEffect(() => {
    if (result.decision !== "REVIEW") return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [result.decision]);

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const shortHash = result.blockchainHash?.slice(0, 8).toUpperCase() ?? "N/A";
  const isAdminOrInvestigator = role === "admin" || role === "investigator";

  // ---- APPROVE ----
  if (result.decision === "APPROVE") {
    return (
      <div className="flex flex-col items-center text-center h-full relative overflow-hidden">
        {/* Confetti */}
        <div className="absolute top-0 left-0 right-0 h-32">
          {Array.from({ length: 16 }).map((_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Animated checkmark */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-900/50 animate-pulse">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                  className="animate-[dash_0.6s_ease-in-out_forwards]"
                />
              </svg>
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-emerald-500/20 animate-ping" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Payment Successful!</h2>
          <p className="text-slate-400 text-sm mb-6">
            ₹{result.amount.toLocaleString("en-IN")} sent to{" "}
            <span className="text-white font-medium">{result.receiverName}</span>
          </p>

          <div className="w-full space-y-2 text-left">
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-500 text-sm">Transaction ID</span>
              <span className="text-white text-sm font-mono">
                TXN#{result.transactionId.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-800">
              <span className="text-slate-500 text-sm">Status</span>
              <span className="text-emerald-400 text-sm font-semibold">✓ Approved</span>
            </div>
            {isAdminOrInvestigator && (
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-500 text-sm">Risk Score</span>
                <span className="text-emerald-400 text-sm font-mono">
                  {result.finalRisk.toFixed(4)}
                </span>
              </div>
            )}
          </div>

          {showAnalysisLink && isAdminOrInvestigator && (
            <a
              href={`/dashboard?txId=${result.transactionId}`}
              className="mt-4 text-sm text-emerald-400/80 hover:text-emerald-400 underline underline-offset-2 transition-colors"
            >
              View risk analysis →
            </a>
          )}
        </div>

        <div className="w-full flex gap-3 pb-2">
          <button className="flex-1 py-3.5 rounded-2xl border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 transition-colors">
            Share Receipt
          </button>
          <button
            onClick={onDone}
            className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold hover:from-emerald-500 hover:to-teal-500 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ---- REVIEW ----
  if (result.decision === "REVIEW") {
    return (
      <div className="flex flex-col items-center text-center h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Amber clock */}
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-4 border-amber-500/60 flex items-center justify-center shadow-xl shadow-amber-900/30">
              <svg className="w-12 h-12 text-amber-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="absolute -inset-1 rounded-full border border-amber-500/20 animate-pulse" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Transaction Under Review</h2>
          <p className="text-slate-400 text-sm mb-5 leading-relaxed">
            We&apos;ve flagged this transaction for security verification.{" "}
            <span className="text-amber-300 font-medium">No money has been deducted.</span>
          </p>

          <div className="w-full bg-amber-950/30 border border-amber-700/30 rounded-2xl p-4 text-left mb-4">
            <p className="text-amber-300 text-sm font-medium mb-1">Expected resolution</p>
            <p className="text-white font-mono text-2xl font-bold">{formatCountdown(countdown)}</p>
            <p className="text-slate-500 text-xs mt-1">Our fraud team will review this transaction</p>
          </div>

          {/* KYC upload (mock) */}
          <div className="w-full border-2 border-dashed border-slate-700 rounded-2xl p-5 text-center mb-4 hover:border-amber-600/50 transition-colors cursor-pointer">
            <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-slate-500 text-sm">Upload Identity Document</p>
            <p className="text-xs text-slate-600 mt-1">Aadhaar / PAN / Passport</p>
          </div>

          {/* Investigator/Admin risk details */}
          {isAdminOrInvestigator && (
            <div className="w-full bg-slate-800/50 rounded-xl p-3 text-left space-y-2">
              <p className="text-xs text-slate-500 font-medium">Risk Analysis</p>
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Final Risk</span>
                <span className="text-xs text-amber-400 font-mono">{result.finalRisk.toFixed(4)}</span>
              </div>
              {role === "admin" && result.gnnScore !== undefined && (
                <>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">GNN Score</span>
                    <span className="text-xs text-blue-400 font-mono">{result.gnnScore.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">EIF Score</span>
                    <span className="text-xs text-purple-400 font-mono">{result.eifScore?.toFixed(4)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button onClick={onDone} className="w-full py-4 rounded-2xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors">
          Back to Home
        </button>
      </div>
    );
  }

  // ---- BLOCK ----
  return (
    <div className="flex flex-col items-center text-center h-full">
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Red shield */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-900/40 to-red-950/20 border-4 border-red-500/60 flex items-center justify-center shadow-xl shadow-red-900/40">
            <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">Transaction Blocked</h2>
        <p className="text-slate-400 text-sm mb-5 leading-relaxed">
          This transaction has been flagged by our fraud detection system.{" "}
          <span className="text-red-300 font-medium">
            Your account has been temporarily restricted.
          </span>
        </p>

        {/* Viewer: only human-readable */}
        {role === "viewer" ? (
          <div className="w-full border-2 border-dashed border-red-800/40 rounded-2xl p-5 text-center mb-4 cursor-pointer hover:border-red-600/50 transition-colors">
            <p className="text-slate-400 text-sm mb-2">Verify your identity to restore access</p>
            <svg className="w-8 h-8 text-slate-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
            <p className="text-xs text-slate-600">Upload Aadhaar / PAN</p>
          </div>
        ) : (
          /* Admin / Investigator: full breakdown */
          <div className="w-full bg-slate-800/50 rounded-xl p-3 text-left space-y-2 mb-4">
            <p className="text-xs text-slate-500 font-medium">Risk Breakdown</p>
            <div className="flex justify-between">
              <span className="text-xs text-slate-400">Final Risk</span>
              <span className="text-xs text-red-400 font-mono font-bold">
                {result.finalRisk.toFixed(4)}
              </span>
            </div>
            {result.gnnScore !== undefined && (
              <>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">GNN Score</span>
                  <span className="text-xs text-blue-400 font-mono">{result.gnnScore.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-400">EIF Score</span>
                  <span className="text-xs text-purple-400 font-mono">{result.eifScore?.toFixed(4)}</span>
                </div>
              </>
            )}
            {result.ringMembership?.isMuleRingMember && (
              <div className="flex justify-between">
                <span className="text-xs text-slate-400">Ring</span>
                <span className="text-xs text-orange-400">
                  {result.ringMembership.ringShape} · {result.ringMembership.role}
                </span>
              </div>
            )}
            {result.riskFactors && result.riskFactors.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mt-2 mb-1">Key Factors</p>
                {result.riskFactors.slice(0, 3).map((f, i) => (
                  <p key={i} className="text-xs text-red-300 flex items-center gap-1">
                    <span>▸</span> {f}
                  </p>
                ))}
              </div>
            )}
            {role === "admin" && result.blockchainHash && (
              <div className="flex justify-between pt-1 border-t border-slate-700">
                <span className="text-xs text-slate-400">Blockchain Ref</span>
                <span className="text-xs text-slate-500 font-mono">{shortHash}…</span>
              </div>
            )}
          </div>
        )}

        {isAdminOrInvestigator && showAnalysisLink && (
          <a
            href={`/dashboard?txId=${result.transactionId}`}
            className="text-sm text-red-400/80 hover:text-red-400 underline underline-offset-2 transition-colors mb-4"
          >
            View full analysis →
          </a>
        )}
      </div>

      <button
        onClick={onDone}
        className="w-full py-4 rounded-2xl border border-red-900/60 text-red-300 font-medium hover:bg-red-950/30 transition-colors"
      >
        Back to Home
      </button>
    </div>
  );
}
