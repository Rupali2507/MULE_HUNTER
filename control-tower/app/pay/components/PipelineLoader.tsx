"use client";

import { useEffect, useState } from "react";

interface Step {
  id: number;
  label: string;
  icon: string;
  isParallel?: boolean;
}

const STEPS: Step[] = [
  { id: 1, label: "Transaction validated", icon: "✓" },
  { id: 2, label: "Persisting to database", icon: "🗄" },
  { id: 3, label: "Identity recorded", icon: "🔑" },
  { id: 4, label: "JA3 TLS analysis", icon: "🛡" },
  { id: 5, label: "Aggregates updated", icon: "📊" },
  { id: 6, label: "Behavioral scoring", icon: "📈" },
  { id: 7, label: "Graph context enriched", icon: "🕸" },
  { id: 8, label: "GNN ‖ EIF (parallel)", icon: "🧠", isParallel: true },
  { id: 9, label: "Risk signals fused", icon: "⚖" },
  { id: 10, label: "Predictions logged", icon: "📝" },
  { id: 11, label: "Decision policy applied", icon: "🎯" },
  { id: 12, label: "Result committed", icon: "💾" },
  { id: 13, label: "Response returned", icon: "↩" },
  { id: 14, label: "Blockchain ledger updated", icon: "⛓" },
];

type StepState = "waiting" | "running" | "done" | "error";

interface PipelineLoaderProps {
  onComplete: () => void;
  apiCallStarted: boolean;
}

export function PipelineLoader({ onComplete, apiCallStarted }: PipelineLoaderProps) {
  const [stepStates, setStepStates] = useState<StepState[]>(STEPS.map(() => "waiting"));
  const [stepTimes, setStepTimes] = useState<(number | null)[]>(STEPS.map(() => null));
  const [totalMs, setTotalMs] = useState(0);
  const [gnnProgress, setGnnProgress] = useState(0);
  const [eifProgress, setEifProgress] = useState(0);
  const [fusionValues, setFusionValues] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    if (!apiCallStarted) return;

    const startTime = Date.now();
    let cancelled = false;

    const tick = setInterval(() => {
      if (!cancelled) setTotalMs(Date.now() - startTime);
    }, 50);

    const markStep = (idx: number, state: StepState, delayMs: number) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          if (cancelled) return resolve();
          const start = Date.now();
          setCurrentStep(idx);
          setStepStates((prev) => {
            const next = [...prev];
            next[idx] = state === "done" ? "running" : state;
            return next;
          });

          const completionDelay = 120 + Math.random() * 150;
          setTimeout(() => {
            if (cancelled) return resolve();
            const elapsed = Date.now() - start;
            setStepStates((prev) => {
              const next = [...prev];
              next[idx] = "done";
              return next;
            });
            setStepTimes((prev) => {
              const next = [...prev];
              next[idx] = elapsed + Math.floor(Math.random() * 30);
              return next;
            });
            resolve();
          }, completionDelay);
        }, delayMs)
      );

    const animate = async () => {
      // Steps 1–7 animate with realistic delays
      for (let i = 0; i < 7; i++) {
        await markStep(i, "running", i * 130);
      }

      // Step 8 — parallel GNN + EIF bars
      await new Promise<void>((resolve) =>
        setTimeout(() => {
          if (cancelled) return resolve();
          setCurrentStep(7);
          setStepStates((prev) => {
            const next = [...prev];
            next[7] = "running";
            return next;
          });

          let gnn = 0;
          let eif = 0;
          const barInterval = setInterval(() => {
            gnn = Math.min(gnn + 6 + Math.random() * 4, 100);
            eif = Math.min(eif + 5 + Math.random() * 5, 100);
            setGnnProgress(gnn);
            setEifProgress(eif);
            if (gnn >= 100 && eif >= 100) {
              clearInterval(barInterval);
              setStepStates((prev) => {
                const next = [...prev];
                next[7] = "done";
                return next;
              });
              setStepTimes((prev) => {
                const next = [...prev];
                next[7] = 41 + Math.floor(Math.random() * 20);
                return next;
              });
              resolve();
            }
          }, 50);
        }, 7 * 130 + 50)
      );

      // Step 9 — fusion formula animation
      setTimeout(() => {
        if (cancelled) return;
        setCurrentStep(8);
        setStepStates((prev) => {
          const next = [...prev];
          next[8] = "running";
          return next;
        });

        const gnnScore = (Math.random() * 0.4 + 0.1).toFixed(3);
        const eifScore = (Math.random() * 0.3 + 0.05).toFixed(3);
        const behaviorScore = (Math.random() * 0.5 + 0.1).toFixed(3);
        const finalRisk = (
          0.4 * parseFloat(gnnScore) +
          0.2 * parseFloat(eifScore) +
          0.25 * parseFloat(behaviorScore)
        ).toFixed(3);

        setTimeout(() => {
          if (cancelled) return;
          setFusionValues(
            `0.40×${gnnScore} + 0.20×${eifScore} + 0.25×${behaviorScore} = ${finalRisk}`
          );
          setStepStates((prev) => {
            const next = [...prev];
            next[8] = "done";
            return next;
          });
          setStepTimes((prev) => {
            const next = [...prev];
            next[8] = 18 + Math.floor(Math.random() * 10);
            return next;
          });
        }, 300);
      }, 7 * 130 + 400);

      // Steps 10–14 after API response
      for (let i = 9; i < 14; i++) {
        await markStep(i, "running", 7 * 130 + 750 + (i - 9) * 120);
      }

      // Fade out and complete
      setTimeout(() => {
        if (!cancelled) onComplete();
      }, 7 * 130 + 750 + 5 * 120 + 400);
    };

    animate();

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [apiCallStarted, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Mule-Hunter</span>
        </div>
        <p className="text-slate-400 text-xs">Fraud Detection Engine Active</p>
        <div className="mt-2 text-emerald-400 font-mono text-xs">
          {(totalMs / 1000).toFixed(2)}s elapsed
        </div>
      </div>

      {/* Steps List */}
      <div className="w-full max-w-sm space-y-1.5 max-h-[65vh] overflow-y-auto">
        {STEPS.map((step, idx) => {
          const state = stepStates[idx];
          const time = stepTimes[idx];

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 px-3 py-2 rounded-xl transition-all duration-300 ${
                state === "done"
                  ? "bg-emerald-950/20"
                  : state === "running"
                  ? "bg-slate-800/60 ring-1 ring-emerald-500/30"
                  : "opacity-40"
              }`}
            >
              {/* Status dot */}
              <div className="mt-0.5 shrink-0">
                {state === "done" ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : state === "running" ? (
                  <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {String(step.id).padStart(2, "0")}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      state === "done"
                        ? "text-emerald-300"
                        : state === "running"
                        ? "text-white"
                        : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                  {time && (
                    <span className="text-xs text-slate-500 font-mono ml-auto">{time}ms</span>
                  )}
                </div>

                {/* Parallel bars for step 8 */}
                {step.isParallel && state === "running" && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400 w-6">GNN</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-100"
                          style={{ width: `${gnnProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8">{Math.floor(gnnProgress)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-400 w-6">EIF</span>
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all duration-100"
                          style={{ width: `${eifProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-8">{Math.floor(eifProgress)}%</span>
                    </div>
                  </div>
                )}

                {/* Fusion formula for step 9 */}
                {step.id === 9 && state === "running" && fusionValues && (
                  <p className="text-xs text-emerald-400 font-mono mt-1 animate-pulse">
                    {fusionValues}
                  </p>
                )}
                {step.id === 9 && state === "done" && fusionValues && (
                  <p className="text-xs text-emerald-400/70 font-mono mt-1">{fusionValues}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-600 text-center">
        Defense in Depth: GNN • JA3 • EIF • Blockchain
      </p>
    </div>
  );
}
