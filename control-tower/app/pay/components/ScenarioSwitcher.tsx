"use client";

import { useState } from "react";
import { PERSONAS, type Persona } from "@/lib/personas";
import { useRole } from "@/hooks/useRole";

interface ScenarioSwitcherProps {
  activePersonaId: string;
  onSwitch: (persona: Persona) => void;
}

const OUTCOME_STYLES = {
  APPROVE: "bg-emerald-950/60 text-emerald-400 border-emerald-700/40",
  REVIEW: "bg-amber-950/60 text-amber-400 border-amber-700/40",
  BLOCK: "bg-red-950/60 text-red-400 border-red-700/40",
};

const PERSONA_ICONS = {
  clean: "👤",
  smurfing: "🔄",
  ring_hub: "⭕",
};

export function ScenarioSwitcher({ activePersonaId, onSwitch }: ScenarioSwitcherProps) {
  const { role } = useRole();
  const [expanded, setExpanded] = useState(false);

  // Only admins see this
  if (role !== "admin") return null;

  return (
    <div className="fixed bottom-6 right-4 z-40">
      {/* Expanded Panel */}
      {expanded && (
        <div className="mb-3 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/60 p-4 w-72 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-white">Demo Personas</p>
              <p className="text-xs text-slate-500">Switch sender profile</p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/40">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Admin</span>
            </div>
          </div>

          <div className="space-y-2">
            {Object.values(PERSONAS).map((persona) => {
              const isActive = persona.id === activePersonaId;
              return (
                <button
                  key={persona.id}
                  onClick={() => {
                    onSwitch(persona);
                    setExpanded(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isActive
                      ? "bg-slate-700/80 border-emerald-500/50 ring-1 ring-emerald-500/30"
                      : "bg-slate-800/50 border-slate-700/40 hover:bg-slate-700/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{PERSONA_ICONS[persona.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{persona.name}</p>
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <p className="text-slate-500 text-xs truncate">{persona.description.slice(0, 40)}…</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                        OUTCOME_STYLES[persona.expectedOutcome]
                      }`}
                    >
                      {persona.expectedOutcome}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 font-mono">
                    Risk: {persona.expectedRisk}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-600 mt-3 text-center">
            💡 Switch personas without logging out
          </p>
        </div>
      )}

      {/* Toggle Pill */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl transition-all ${
          expanded
            ? "bg-slate-700 border border-slate-600 text-white"
            : "bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-emerald-900/50"
        }`}
      >
        <span className="text-sm">🎭</span>
        <span className="text-sm font-semibold">Demo Mode</span>
        <svg
          className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
