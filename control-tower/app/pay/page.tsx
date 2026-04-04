"use client";

import { useState, useCallback } from "react";
import { SenderProfile } from "./components/SenderProfile";
import { ReceiverForm } from "./components/ReceiverForm";
import { AmountForm } from "./components/AmountForm";
import { ReviewPin } from "./components/ReviewPin";
import { PipelineLoader } from "./components/PipelineLoader";
import { ResultScreen } from "./components/ResultScreen";
import { ScenarioSwitcher } from "./components/ScenarioSwitcher";
import { PERSONAS, JA3_FINGERPRINTS, type Persona } from "@/lib/personas";
import { useRole } from "@/hooks/useRole";

type Step = "sender" | "receiver" | "amount" | "review" | "pipeline" | "result";

interface ReceiverData {
  accountNumber: string;
  ifscCode: string;
  name: string;
  bankName: string;
}

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

const STEP_LABELS: Record<Step, string> = {
  sender: "Your Account",
  receiver: "Receiver",
  amount: "Amount",
  review: "Confirm",
  pipeline: "Processing",
  result: "Done",
};

const STEP_ORDER: Step[] = ["sender", "receiver", "amount", "review", "pipeline", "result"];

function ProgressBar({ currentStep }: { currentStep: Step }) {
  const visibleSteps: Step[] = ["sender", "receiver", "amount", "review"];
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1.5">
      {visibleSteps.map((step, i) => {
        const stepIdx = STEP_ORDER.indexOf(step);
        const isDone = stepIdx < currentIdx;
        const isActive = step === currentStep;
        return (
          <div key={step} className="flex items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? "bg-emerald-500 text-white"
                    : isActive
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400/40"
                    : "bg-slate-700 text-slate-500"
                }`}
              >
                {isDone ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-[9px] font-medium ${isActive ? "text-emerald-400" : isDone ? "text-slate-500" : "text-slate-600"}`}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < visibleSteps.length - 1 && (
              <div
                className={`h-px w-6 mb-3 rounded-full transition-all ${
                  stepIdx < currentIdx ? "bg-emerald-500" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PayPage() {
  const { name: userName } = useRole();

  const [step, setStep] = useState<Step>("sender");
  const [activePersona, setActivePersona] = useState<Persona>(PERSONAS.clean);
  const [receiver, setReceiver] = useState<ReceiverData | null>(null);
  const [amountData, setAmountData] = useState<{ amount: number; purpose: string; note: string } | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [apiCallStarted, setApiCallStarted] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  // Called when user presses Pay Now
  const handlePay = async (pin: string) => {
    if (!receiver || !amountData) return;

    const transactionId = crypto.randomUUID();
    const timestamp = new Date().toISOString().slice(0, 19); // no trailing Z

    setStep("pipeline");
    setApiCallStarted(true);
    setPipelineComplete(false);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-JA3-Fingerprint": JA3_FINGERPRINTS[activePersona.type],
        },
        body: JSON.stringify({
          transactionId,
          sourceAccount: activePersona.sourceAccount,
          targetAccount: receiver.accountNumber.slice(-4), // use last 4 as mock node ID
          amount: amountData.amount,
          timestamp,
        }),
      });

      let txResult: TransactionResult;

      if (res.ok) {
        const data = await res.json();
        txResult = {
          decision: data.decision ?? data.riskDecision ?? "APPROVE",
          finalRisk: data.finalRisk ?? data.riskScore ?? 0.1,
          transactionId,
          amount: amountData.amount,
          receiverName: receiver.name,
          gnnScore: data.gnnScore ?? data.mlScores?.gnnScore,
          eifScore: data.eifScore ?? data.mlScores?.eifScore,
          behaviorScore: data.behaviorScore,
          blockchainHash: data.blockchainHash ?? data.merkleHash,
          riskFactors: data.riskFactors ?? data.topRiskFactors,
          ringMembership: data.ringMembership ?? data.muleRingDetection,
        };
      } else {
        // Fallback: derive outcome from persona for reliable demo
        txResult = buildFallbackResult(activePersona, transactionId, amountData.amount, receiver.name);
      }

      setResult(txResult);
    } catch {
      // Network error fallback — still show demo result
      setResult(buildFallbackResult(activePersona, transactionId, amountData.amount, receiver.name));
    }

    // If pipeline animation is already done, go to result
    if (pipelineComplete) {
      setStep("result");
    }
  };

  const handlePipelineComplete = useCallback(() => {
    setPipelineComplete(true);
    if (result) {
      setStep("result");
    }
  }, [result]);

  // When both pipeline anim finishes AND API returns, show result
  if (step === "pipeline" && pipelineComplete && result) {
    // Will transition via handlePipelineComplete
  }

  const handleDone = () => {
    setStep("sender");
    setReceiver(null);
    setAmountData(null);
    setResult(null);
    setApiCallStarted(false);
    setPipelineComplete(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top Bar */}
      {step !== "pipeline" && step !== "result" && (
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <span className="text-white font-bold text-xs">M</span>
            </div>
            <span className="text-white font-bold text-sm tracking-tight">MuleHunter Pay</span>
          </div>

          {/* Step progress - only show during flow steps */}
          {["sender", "receiver", "amount", "review"].includes(step) && (
            <ProgressBar currentStep={step} />
          )}

          <div className="text-right">
            <p className="text-xs text-slate-500">{userName}</p>
            <p className="text-xs text-emerald-400 font-mono">
              {activePersona.maskedAccount}
            </p>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-5 py-6">
        {step === "sender" && (
          <SenderProfile
            persona={activePersona}
            onNext={() => setStep("receiver")}
          />
        )}

        {step === "receiver" && (
          <ReceiverForm
            onNext={(r) => {
              setReceiver(r);
              setStep("amount");
            }}
            onBack={() => setStep("sender")}
          />
        )}

        {step === "amount" && receiver && (
          <AmountForm
            availableBalance={activePersona.balance}
            receiverName={receiver.name}
            onNext={(a) => {
              setAmountData(a);
              setStep("review");
            }}
            onBack={() => setStep("receiver")}
          />
        )}

        {step === "review" && receiver && amountData && (
          <ReviewPin
            persona={activePersona}
            receiver={receiver}
            amount={amountData.amount}
            purpose={amountData.purpose}
            note={amountData.note}
            onPay={handlePay}
            onBack={() => setStep("amount")}
          />
        )}

        {step === "result" && result && (
          <ResultScreen result={result} onDone={handleDone} />
        )}
      </main>

      {/* Pipeline overlay (portal-like, covers everything) */}
      {step === "pipeline" && (
        <PipelineLoader
          apiCallStarted={apiCallStarted}
          onComplete={handlePipelineComplete}
        />
      )}

      {/* Admin scenario switcher */}
      <ScenarioSwitcher
        activePersonaId={activePersona.id}
        onSwitch={(p) => {
          setActivePersona(p);
          setStep("sender");
          setReceiver(null);
          setAmountData(null);
          setResult(null);
        }}
      />
    </div>
  );
}

// Deterministic fallback result for demo reliability
function buildFallbackResult(
  persona: Persona,
  transactionId: string,
  amount: number,
  receiverName: string
): TransactionResult {
  const riskMap = {
    clean: { risk: 0.18, decision: "APPROVE" as const, gnn: 0.12, eif: 0.09 },
    smurfing: { risk: 0.58, decision: "REVIEW" as const, gnn: 0.61, eif: 0.49 },
    ring_hub: { risk: 0.87, decision: "BLOCK" as const, gnn: 0.92, eif: 0.78 },
  };

  const r = riskMap[persona.type];

  return {
    decision: r.decision,
    finalRisk: r.risk,
    transactionId,
    amount,
    receiverName,
    gnnScore: r.gnn,
    eifScore: r.eif,
    behaviorScore: persona.type === "ring_hub" ? 0.83 : persona.type === "smurfing" ? 0.55 : 0.11,
    riskFactors:
      persona.type === "ring_hub"
        ? ["member_of_star_mule_ring", "high_pagerank_hub", "second_hop_fraud_rate > 0.8"]
        : persona.type === "smurfing"
        ? ["high_tx_velocity_7d", "low_amount_entropy", "burst_score elevated"]
        : [],
    ringMembership:
      persona.type === "ring_hub"
        ? { isMuleRingMember: true, ringShape: "STAR", role: "HUB" }
        : { isMuleRingMember: false },
    blockchainHash:
      persona.type !== "clean"
        ? Math.random().toString(16).slice(2, 66)
        : undefined,
  };
}
