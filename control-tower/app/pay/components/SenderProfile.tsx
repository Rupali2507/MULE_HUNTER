"use client";

import { useState } from "react";
import type { Persona } from "@/lib/personas";

interface SenderProfileProps {
  persona: Persona;
  onNext: () => void;
}

export function SenderProfile({ persona, onNext }: SenderProfileProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(persona.accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase mb-1">
          Your Account
        </p>
        <h2 className="text-2xl font-bold text-white">Payment Details</h2>
        <p className="text-sm text-slate-400 mt-1">
          Confirm your account before proceeding
        </p>
      </div>

      {/* Sender Card */}
      <div className="flex-1 space-y-4">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-800/50 border border-slate-700/50">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-900/30">
            {persona.avatarInitials}
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{persona.name}</p>
            <p className="text-slate-400 text-sm">{persona.email}</p>
            <p className="text-slate-500 text-xs mt-0.5">{persona.phone}</p>
          </div>
        </div>

        {/* Account Number */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40">
          <p className="text-xs text-slate-500 mb-1 font-medium">Account Number</p>
          <div className="flex items-center justify-between">
            <p className="text-white font-mono text-lg tracking-wider">
              {persona.maskedAccount}
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-950/40 px-2.5 py-1 rounded-lg"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bank Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40">
            <p className="text-xs text-slate-500 mb-1 font-medium">Bank</p>
            <p className="text-white text-sm font-medium leading-tight">{persona.bankName}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/40">
            <p className="text-xs text-slate-500 mb-1 font-medium">IFSC Code</p>
            <p className="text-white text-sm font-mono font-medium">{persona.ifscCode}</p>
          </div>
        </div>

        {/* Balance */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-teal-950/40 border border-emerald-800/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400/70 font-medium mb-1">Available Balance</p>
              <p className="text-3xl font-bold text-white">
                ₹{persona.balance.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400/70">Account Active</span>
          </div>
        </div>
      </div>

      {/* Proceed Button */}
      <button
        onClick={onNext}
        className="mt-6 w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold text-lg shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 transition-all active:scale-[0.98]"
      >
        Proceed to Pay →
      </button>
    </div>
  );
}
