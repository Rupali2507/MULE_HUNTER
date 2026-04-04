"use client";

import { useState } from "react";
import type { Persona } from "@/lib/personas";

interface ReceiverData {
  accountNumber: string;
  ifscCode: string;
  name: string;
  bankName: string;
}

interface ReviewPinProps {
  persona: Persona;
  receiver: ReceiverData;
  amount: number;
  purpose: string;
  note: string;
  onPay: (pin: string) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function ReviewPin({
  persona,
  receiver,
  amount,
  purpose,
  note,
  onPay,
  onBack,
  isLoading = false,
}: ReviewPinProps) {
  const [pin, setPin] = useState("");

  const handlePinKey = (key: string) => {
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 4) {
      setPin((p) => p + key);
    }
  };

  const handlePay = () => {
    if (pin.length === 4 && !isLoading) {
      onPay(pin);
    }
  };

  const txnId = `TXN#${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const now = new Date();
  const timestamp = now.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const PAD_KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "del"],
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="mb-5">
        <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase mb-1">
          Step 4 of 4
        </p>
        <h2 className="text-2xl font-bold text-white">Review & Confirm</h2>
        <p className="text-sm text-slate-400 mt-1">
          Enter your 4-digit UPI PIN to authorise
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        {/* Transaction Summary Card */}
        <div className="rounded-2xl bg-slate-800/70 border border-slate-700/50 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-emerald-950/50 to-teal-950/30 border-b border-slate-700/40">
            <p className="text-xs text-slate-500 font-medium">Amount to Pay</p>
            <p className="text-3xl font-bold text-white mt-0.5">
              ₹{amount.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-500">From</span>
              <div className="text-right">
                <p className="text-white text-sm font-medium">{persona.name}</p>
                <p className="text-slate-500 text-xs">
                  {persona.maskedAccount} · {persona.bankName}
                </p>
              </div>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between items-start">
              <span className="text-xs text-slate-500">To</span>
              <div className="text-right">
                <p className="text-white text-sm font-medium">{receiver.name}</p>
                <p className="text-slate-500 text-xs">
                  ••{receiver.accountNumber.slice(-4)} · {receiver.bankName}
                </p>
              </div>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Purpose</span>
              <span className="text-white text-sm">{purpose}</span>
            </div>
            {note && (
              <>
                <div className="h-px bg-slate-700/50" />
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Note</span>
                  <span className="text-slate-300 text-sm italic">"{note}"</span>
                </div>
              </>
            )}
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Date & Time</span>
              <span className="text-slate-300 text-xs">{timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500">Reference</span>
              <span className="text-slate-400 text-xs font-mono">{txnId}</span>
            </div>
          </div>
        </div>

        {/* PIN Display */}
        <div className="text-center py-3">
          <p className="text-xs text-slate-500 mb-3 font-medium">UPI PIN</p>
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < pin.length
                    ? "bg-emerald-400 border-emerald-400"
                    : "border-slate-600"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 px-4">
          {PAD_KEYS.flat().map((key, idx) => (
            <button
              key={idx}
              onClick={() => key && handlePinKey(key)}
              disabled={!key || isLoading}
              className={`py-3.5 rounded-xl font-semibold text-lg transition-all active:scale-[0.93] ${
                key === "del"
                  ? "text-slate-400 bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/50 text-sm"
                  : key
                  ? "text-white bg-slate-800 border border-slate-700/40 hover:bg-slate-700"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              {key === "del" ? (
                <span className="flex justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                </span>
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-4 rounded-2xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          ← Back
        </button>
        <button
          onClick={handlePay}
          disabled={pin.length < 4 || isLoading}
          className={`flex-[2] py-4 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] ${
            pin.length === 4 && !isLoading
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500"
              : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </span>
          ) : (
            "Pay Now 🔒"
          )}
        </button>
      </div>
    </div>
  );
}
