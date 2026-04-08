"use client";

/**
 * PaymentSection.tsx  —  MULE_HUNTER Control Tower
 *
 * Drop-in replacement for the mock Pay section.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. User fills UPI payment form.
 * 2. On submit we POST to /api/transactions (the real Spring Boot backend).
 * 3. Backend returns { decision, finalRisk, … } (score 0–1).
 * 4. We interpret the verdict:
 *      APPROVE  (score < 0.45) → transaction succeeds
 *      REVIEW   (0.45 – 0.75) → KYC required within 24 h + penalty applied
 *      BLOCK    (score ≥ 0.75) → KYC required within 12 h, all UPI suspended
 * 5. All state is stored in localStorage so the KYC timer persists across reloads.
 *
 * INTEGRATION
 * ───────────
 * • Replace `BACKEND_URL` if your Spring Boot is not on port 8082.
 * • The component reads/writes `mh_kyc_state` from localStorage.
 * • Mount inside your existing dashboard layout:
 *       import PaymentSection from "@/components/PaymentSection";
 *       <PaymentSection currentUserAccount="1553" />
 */

import { useState, useEffect, useCallback, useRef } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

// Penalty schedule (INR)
const PENALTY_REVIEW = 500;   // applied immediately on REVIEW verdict
const PENALTY_BLOCK  = 2000;  // applied immediately on BLOCK verdict
const PENALTY_KYC_MISS_REVIEW = 1000; // extra if KYC not done within 24 h
const PENALTY_KYC_MISS_BLOCK  = 5000; // extra if KYC not done within 12 h

// KYC deadlines
const KYC_DEADLINE_REVIEW_H = 24;
const KYC_DEADLINE_BLOCK_H  = 12;

// ── Types ─────────────────────────────────────────────────────────────────────
type Decision = "APPROVE" | "REVIEW" | "BLOCK";

interface TransactionResponse {
  transactionId: string;
  decision: Decision;
  finalRisk: number;
  gnnScore?: number;
  eifScore?: number;
  behaviorScore?: number;
  blockReason?: string;
  timestamp?: string;
}

interface KycState {
  status: "none" | "pending_review" | "pending_block" | "completed" | "overdue";
  deadlineIso: string | null;   // ISO timestamp
  deadlineHours: number | null;
  penaltyApplied: number;
  penaltyExtra: number;
  triggeredBy: string | null;   // transactionId
  accountBlocked: boolean;
}

const EMPTY_KYC: KycState = {
  status: "none",
  deadlineIso: null,
  deadlineHours: null,
  penaltyApplied: 0,
  penaltyExtra: 0,
  triggeredBy: null,
  accountBlocked: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadKyc(account: string): KycState {
  if (typeof window === "undefined") return EMPTY_KYC;
  try {
    const raw = localStorage.getItem(`mh_kyc_${account}`);
    return raw ? JSON.parse(raw) : EMPTY_KYC;
  } catch {
    return EMPTY_KYC;
  }
}

function saveKyc(account: string, state: KycState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`mh_kyc_${account}`, JSON.stringify(state));
}

function msLeft(isoDeadline: string | null): number {
  if (!isoDeadline) return Infinity;
  return new Date(isoDeadline).getTime() - Date.now();
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function riskColor(score: number): string {
  if (score < 0.45) return "#16a34a";
  if (score < 0.75) return "#d97706";
  return "#dc2626";
}

function riskLabel(score: number): string {
  if (score < 0.45) return "LOW RISK";
  if (score < 0.75) return "MEDIUM RISK — REVIEW";
  return "HIGH RISK — BLOCKED";
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(1, Math.max(0, score)) * 100;
  const color = riskColor(score);
  return (
    <div style={{ margin: "1rem 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          letterSpacing: "0.08em",
          color: "#6b7280",
          marginBottom: 6,
          fontFamily: "monospace",
        }}
      >
        <span>RISK SCORE</span>
        <span style={{ color, fontWeight: 700 }}>
          {(score * 100).toFixed(1)}% — {riskLabel(score)}
        </span>
      </div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: "#1f2937",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "#4b5563",
          marginTop: 4,
          fontFamily: "monospace",
        }}
      >
        <span>0 — SAFE</span>
        <span style={{ color: "#d97706" }}>0.45 REVIEW</span>
        <span style={{ color: "#dc2626" }}>0.75 BLOCK</span>
      </div>
    </div>
  );
}

function ScoreBreakdown({ result }: { result: TransactionResponse }) {
  const rows = [
    { label: "GNN (graph network)", value: result.gnnScore, weight: "40%" },
    { label: "EIF (anomaly forest)", value: result.eifScore, weight: "20%" },
    { label: "Behavior", value: result.behaviorScore, weight: "25%" },
    { label: "Final composite", value: result.finalRisk, weight: "—" },
  ];
  return (
    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", fontFamily: "monospace", marginTop: 8 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #374151" }}>
          <th style={{ textAlign: "left", color: "#6b7280", fontWeight: 400, padding: "4px 0" }}>Signal</th>
          <th style={{ textAlign: "center", color: "#6b7280", fontWeight: 400 }}>Weight</th>
          <th style={{ textAlign: "right", color: "#6b7280", fontWeight: 400 }}>Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={{ borderBottom: "1px solid #1f2937" }}>
            <td style={{ color: "#d1d5db", padding: "5px 0" }}>{r.label}</td>
            <td style={{ textAlign: "center", color: "#9ca3af" }}>{r.weight}</td>
            <td
              style={{
                textAlign: "right",
                fontWeight: r.label.includes("Final") ? 700 : 400,
                color: r.value !== undefined ? riskColor(r.value) : "#9ca3af",
              }}
            >
              {r.value !== undefined ? (r.value * 100).toFixed(2) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface KycBannerProps {
  kyc: KycState;
  onCompleteKyc: () => void;
  account: string;
}

function KycBanner({ kyc, onCompleteKyc, account }: KycBannerProps) {
  const [countdown, setCountdown] = useState(() =>
    fmtCountdown(msLeft(kyc.deadlineIso))
  );

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(fmtCountdown(msLeft(kyc.deadlineIso)));
    }, 1000);
    return () => clearInterval(t);
  }, [kyc.deadlineIso]);

  if (kyc.status === "none" || kyc.status === "completed") return null;

  const isBlock = kyc.status === "pending_block" || kyc.accountBlocked;
  const overdue = msLeft(kyc.deadlineIso) <= 0;

  const bannerBg = isBlock ? "#450a0a" : "#451a03";
  const bannerBorder = isBlock ? "#dc2626" : "#d97706";
  const icon = isBlock ? "🔴" : "🟡";

  return (
    <div
      style={{
        background: bannerBg,
        border: `1px solid ${bannerBorder}`,
        borderRadius: 10,
        padding: "1rem 1.25rem",
        marginBottom: "1.25rem",
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isBlock ? "#fca5a5" : "#fcd34d",
            letterSpacing: "0.06em",
          }}
        >
          {isBlock
            ? overdue
              ? "KYC OVERDUE — ACCOUNT SUSPENDED"
              : "ACTION REQUIRED: COMPLETE KYC WITHIN 12 HOURS"
            : overdue
            ? "KYC REVIEW OVERDUE"
            : "ACTION REQUIRED: COMPLETE KYC WITHIN 24 HOURS"}
        </span>
      </div>

      <p style={{ fontSize: 12, color: "#d1d5db", margin: "0 0 10px", lineHeight: 1.6 }}>
        {isBlock
          ? `A high-risk transaction flagged your account. ALL UPI transactions are suspended
             until KYC is verified. Penalty applied: ₹${kyc.penaltyApplied.toLocaleString("en-IN")}.
             ${overdue ? `Additional overdue penalty: ₹${PENALTY_KYC_MISS_BLOCK.toLocaleString("en-IN")} levied.` : ""}`
          : `A transaction triggered a fraud review. You may continue using UPI but KYC must
             be completed within 24 hours. Penalty applied: ₹${kyc.penaltyApplied.toLocaleString("en-IN")}.
             ${overdue ? `Additional overdue penalty: ₹${PENALTY_KYC_MISS_REVIEW.toLocaleString("en-IN")} levied.` : ""}`}
      </p>

      {!overdue && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 11, color: "#9ca3af" }}>TIME REMAINING</span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: isBlock ? "#f87171" : "#fbbf24",
              letterSpacing: "0.12em",
            }}
          >
            {countdown}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCompleteKyc}
          style={{
            background: isBlock ? "#dc2626" : "#d97706",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            padding: "8px 18px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          COMPLETE KYC NOW →
        </button>
        <span style={{ fontSize: 11, color: "#6b7280", alignSelf: "center" }}>
          Ref: {kyc.triggeredBy?.slice(0, 12)}…
        </span>
      </div>
    </div>
  );
}

// ── KYC Modal (simulated) ─────────────────────────────────────────────────────
function KycModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"form" | "verifying" | "done">("form");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [selfie, setSelfie] = useState(false);

  async function submit() {
    if (aadhaar.length < 12 || pan.length < 10 || !selfie) return;
    setStep("verifying");
    // Simulate verification delay
    await new Promise((r) => setTimeout(r, 2400));
    setStep("done");
    setTimeout(onSuccess, 1200);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#111827",
          border: "1px solid #374151",
          borderRadius: 14,
          padding: "1.75rem",
          width: 400,
          fontFamily: "monospace",
        }}
      >
        {step === "form" && (
          <>
            <h2
              style={{
                color: "#f9fafb",
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 18,
                letterSpacing: "0.05em",
              }}
            >
              KYC VERIFICATION
            </h2>

            <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>
              AADHAAR NUMBER (12 digits)
            </label>
            <input
              maxLength={12}
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
              placeholder="XXXX XXXX XXXX"
              style={{
                width: "100%",
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 7,
                color: "#f9fafb",
                padding: "8px 12px",
                fontSize: 14,
                marginBottom: 14,
                boxSizing: "border-box",
                letterSpacing: "0.1em",
                outline: "none",
              }}
            />

            <label style={{ fontSize: 11, color: "#9ca3af", display: "block", marginBottom: 4 }}>
              PAN NUMBER
            </label>
            <input
              maxLength={10}
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              style={{
                width: "100%",
                background: "#1f2937",
                border: "1px solid #374151",
                borderRadius: 7,
                color: "#f9fafb",
                padding: "8px 12px",
                fontSize: 14,
                marginBottom: 14,
                boxSizing: "border-box",
                letterSpacing: "0.15em",
                outline: "none",
              }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "#d1d5db",
                marginBottom: 20,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selfie}
                onChange={(e) => setSelfie(e.target.checked)}
              />
              I consent to liveness / selfie verification
            </label>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={submit}
                disabled={aadhaar.length < 12 || pan.length < 10 || !selfie}
                style={{
                  flex: 1,
                  background: "#1d4ed8",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: aadhaar.length < 12 || pan.length < 10 || !selfie ? 0.45 : 1,
                  letterSpacing: "0.05em",
                }}
              >
                SUBMIT FOR VERIFICATION
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "#1f2937",
                  color: "#9ca3af",
                  border: "1px solid #374151",
                  borderRadius: 7,
                  padding: "10px 16px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "verifying" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid #1d4ed8",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "#d1d5db", fontSize: 13 }}>
              Verifying identity with UIDAI & NSDL…
            </p>
          </div>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div
              style={{
                width: 48,
                height: 48,
                background: "#14532d",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 24,
              }}
            >
              ✓
            </div>
            <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 700 }}>
              KYC VERIFIED SUCCESSFULLY
            </p>
            <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>
              All services restored. Restrictions lifted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PaymentSection({
  currentUserAccount = "1553",
}: {
  currentUserAccount?: string;
}) {
  // Form state
  const [toUpi, setToUpi] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKycModal, setShowKycModal] = useState(false);

  // KYC state
  const [kyc, setKyc] = useState<KycState>(() => loadKyc(currentUserAccount));

  // Keep KYC overdue status updated
  const kycRef = useRef(kyc);
  kycRef.current = kyc;

  useEffect(() => {
    const t = setInterval(() => {
      const cur = kycRef.current;
      if (
        (cur.status === "pending_review" || cur.status === "pending_block") &&
        cur.deadlineIso &&
        msLeft(cur.deadlineIso) <= 0 
        // cur.status !== "overdue"
      ) {
        const extra =
          cur.status === "pending_block"
            ? PENALTY_KYC_MISS_BLOCK
            : PENALTY_KYC_MISS_REVIEW;
        const updated: KycState = {
          ...cur,
          status: "overdue",
          penaltyExtra: extra,
          accountBlocked: true,
        };
        setKyc(updated);
        saveKyc(currentUserAccount, updated);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [currentUserAccount]);

  const accountBlocked =
    kyc.accountBlocked &&
    kyc.status !== "completed";

  const applyKycState = useCallback(
    (decision: Decision, txId: string) => {
      if (decision === "APPROVE") return;

      const hoursDeadline =
        decision === "BLOCK" ? KYC_DEADLINE_BLOCK_H : KYC_DEADLINE_REVIEW_H;
      const deadline = new Date(
        Date.now() + hoursDeadline * 60 * 60 * 1000
      ).toISOString();
      const penalty =
        decision === "BLOCK" ? PENALTY_BLOCK : PENALTY_REVIEW;

      const updated: KycState = {
        status: decision === "BLOCK" ? "pending_block" : "pending_review",
        deadlineIso: kyc.deadlineIso ?? deadline, // don't reset existing timer
        deadlineHours: hoursDeadline,
        penaltyApplied: kyc.penaltyApplied + penalty,
        penaltyExtra: 0,
        triggeredBy: txId,
        accountBlocked: decision === "BLOCK",
      };
      setKyc(updated);
      saveKyc(currentUserAccount, updated);
    },
    [kyc, currentUserAccount]
  );

  const handleKycSuccess = useCallback(() => {
    const cleared: KycState = {
      ...EMPTY_KYC,
      status: "completed",
      penaltyApplied: kyc.penaltyApplied,
    };
    setKyc(cleared);
    saveKyc(currentUserAccount, cleared);
    setShowKycModal(false);
  }, [kyc.penaltyApplied, currentUserAccount]);

  async function submitPayment() {
    if (!toAccount || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid recipient account and amount.");
      return;
    }
    if (accountBlocked) {
      setError("Your account is blocked. Complete KYC to resume UPI transactions.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      transactionId: uuid(),
      sourceAccount: currentUserAccount,
      targetAccount: toAccount,
      amount: parseFloat(amount),
      timestamp: new Date().toISOString().slice(0, 19), // no trailing Z
      note,
      upiId: toUpi,
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
      }

      const data: TransactionResponse = await res.json();
      setResult(data);

      // Apply KYC state based on verdict
      applyKycState(data.decision ?? "APPROVE", data.transactionId ?? payload.transactionId);

      // Clear form on approve
      if (data.decision === "APPROVE") {
        setToUpi("");
        setToAccount("");
        setAmount("");
        setNote("");
      }
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error contacting backend.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        maxWidth: 540,
        margin: "0 auto",
        fontFamily: "'Courier New', Courier, monospace",
        color: "#f9fafb",
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 18, color: "#f9fafb" }}>
        ▶ UPI PAYMENT
      </h2>

      {/* KYC banner */}
      <KycBanner
        kyc={kyc}
        account={currentUserAccount}
        onCompleteKyc={() => setShowKycModal(true)}
      />

      {/* Penalty summary chip */}
      {kyc.penaltyApplied > 0 && (
        <div
          style={{
            background: "#1c1917",
            border: "1px solid #44403c",
            borderRadius: 8,
            padding: "8px 14px",
            marginBottom: 14,
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#a8a29e" }}>TOTAL PENALTIES LEVIED</span>
          <span style={{ color: "#fca5a5", fontWeight: 700 }}>
            ₹{(kyc.penaltyApplied + kyc.penaltyExtra).toLocaleString("en-IN")}
          </span>
        </div>
      )}

      {/* Payment form */}
      <div
        style={{
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: 12,
          padding: "1.25rem",
          marginBottom: "1.25rem",
          opacity: accountBlocked ? 0.45 : 1,
          pointerEvents: accountBlocked ? "none" : "auto",
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>
            UPI ID (optional)
          </label>
          <input
            value={toUpi}
            onChange={(e) => setToUpi(e.target.value)}
            placeholder="e.g. name@upi"
            style={{
              width: "100%",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 7,
              color: "#f9fafb",
              padding: "9px 12px",
              fontSize: 13,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>
            RECIPIENT ACCOUNT ID *
          </label>
          <input
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value.replace(/\D/g, ""))}
            placeholder="Numeric account ID"
            style={{
              width: "100%",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 7,
              color: "#f9fafb",
              padding: "9px 12px",
              fontSize: 13,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <p style={{ fontSize: 10, color: "#4b5563", margin: "4px 0 0" }}>
            Must be a numeric graph node ID as used in the backend.
          </p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>
            AMOUNT (₹) *
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: "100%",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 7,
              color: "#f9fafb",
              padding: "9px 12px",
              fontSize: 20,
              fontWeight: 700,
              boxSizing: "border-box",
              outline: "none",
              letterSpacing: "0.04em",
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>
            NOTE (optional)
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Payment for…"
            style={{
              width: "100%",
              background: "#1f2937",
              border: "1px solid #374151",
              borderRadius: 7,
              color: "#f9fafb",
              padding: "9px 12px",
              fontSize: 13,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        <button
          onClick={submitPayment}
          disabled={loading}
          style={{
            width: "100%",
            background: loading ? "#1e3a5f" : "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 0",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "default" : "pointer",
            letterSpacing: "0.1em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "background 0.2s",
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #93c5fd",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              RUNNING MULE HUNTER…
            </>
          ) : (
            "SEND & VERIFY →"
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#450a0a",
            border: "1px solid #dc2626",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#fca5a5",
            marginBottom: 14,
          }}
        >
          ✗ {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div
          style={{
            background: "#0f172a",
            border: `1px solid ${riskColor(result.finalRisk)}`,
            borderRadius: 12,
            padding: "1.25rem",
            fontSize: 12,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: riskColor(result.finalRisk),
                letterSpacing: "0.1em",
              }}
            >
              {result.decision === "APPROVE" && "✓ TRANSACTION APPROVED"}
              {result.decision === "REVIEW" && "⚠ FLAGGED FOR REVIEW"}
              {result.decision === "BLOCK" && "✗ TRANSACTION BLOCKED"}
            </span>
            <span style={{ color: "#4b5563", fontSize: 10 }}>
              {result.transactionId?.slice(0, 8)}…
            </span>
          </div>

          {/* Risk gauge */}
          <RiskGauge score={result.finalRisk} />

          {/* Score breakdown */}
          <ScoreBreakdown result={result} />

          {/* Verdict explanation */}
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "#1e293b",
              borderRadius: 8,
              lineHeight: 1.7,
              color: "#94a3b8",
            }}
          >
            {result.decision === "APPROVE" && (
              <p style={{ margin: 0 }}>
                Risk score below threshold. Payment of ₹{Number(amount).toLocaleString("en-IN")} to
                account {toAccount} processed successfully.
              </p>
            )}
            {result.decision === "REVIEW" && (
              <p style={{ margin: 0 }}>
                Elevated risk detected. Payment is held pending review.{" "}
                <strong style={{ color: "#fbbf24" }}>
                  You must complete KYC within {KYC_DEADLINE_REVIEW_H} hours
                </strong>{" "}
                to restore full services. A penalty of ₹{PENALTY_REVIEW.toLocaleString("en-IN")} has been applied.
                Missing the KYC deadline will incur an additional
                ₹{PENALTY_KYC_MISS_REVIEW.toLocaleString("en-IN")} penalty.
              </p>
            )}
            {result.decision === "BLOCK" && (
              <p style={{ margin: 0 }}>
                High-risk transaction detected by MuleHunter GNN + EIF.{" "}
                <strong style={{ color: "#f87171" }}>
                  ALL UPI transactions are now suspended.
                </strong>{" "}
                Complete KYC within {KYC_DEADLINE_BLOCK_H} hours to reinstate your account. Penalty: ₹
                {PENALTY_BLOCK.toLocaleString("en-IN")}. Failure to complete KYC will add
                ₹{PENALTY_KYC_MISS_BLOCK.toLocaleString("en-IN")} and trigger regulatory escalation.
              </p>
            )}
          </div>

          {/* Reason */}
          {result.blockReason && (
            <p style={{ marginTop: 10, color: "#6b7280", fontSize: 11, letterSpacing: "0.04em" }}>
              REASON: {result.blockReason}
            </p>
          )}
        </div>
      )}

      {/* KYC modal */}
      {showKycModal && (
        <KycModal
          onClose={() => setShowKycModal(false)}
          onSuccess={handleKycSuccess}
        />
      )}
    </div>
  );
}