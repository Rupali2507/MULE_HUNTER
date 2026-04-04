"use client";

import { useState, useRef } from "react";
import { MOCK_RECEIVERS } from "@/lib/personas";

interface ReceiverData {
  accountNumber: string;
  ifscCode: string;
  name: string;
  bankName: string;
  branch?: string;
}

interface ReceiverFormProps {
  onNext: (receiver: ReceiverData) => void;
  onBack: () => void;
}

export function ReceiverForm({ onNext, onBack }: ReceiverFormProps) {
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState<ReceiverData | null>(null);
  const [error, setError] = useState("");
  const verifyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAccountChange = (val: string) => {
    const clean = val.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(clean);
    setVerified(null);
    setError("");

    if (clean.length === 10 && ifscCode.length >= 11) {
      triggerVerify(clean, ifscCode);
    }
  };

  const handleIfscChange = (val: string) => {
    const clean = val.toUpperCase().slice(0, 11);
    setIfscCode(clean);
    setVerified(null);
    setError("");

    if (accountNumber.length === 10 && clean.length === 11) {
      triggerVerify(accountNumber, clean);
    }
  };

  const triggerVerify = (acct: string, ifsc: string) => {
    if (verifyTimeout.current) clearTimeout(verifyTimeout.current);
    setVerifying(true);

    verifyTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mock/verify-account?accountNo=${acct}`);
        if (!res.ok) {
          setError("Account not found. Please check the details.");
          setVerifying(false);
          return;
        }
        const data = await res.json();
        setVerified({
          accountNumber: acct,
          ifscCode: ifsc,
          name: data.name,
          bankName: data.bankName,
          branch: data.branch,
        });
        setError("");
      } catch {
        setError("Verification failed. Please try again.");
      } finally {
        setVerifying(false);
      }
    }, 600);
  };

  const handleRecentContact = (r: (typeof MOCK_RECEIVERS)[0]) => {
    setAccountNumber(r.accountNumber);
    setIfscCode(r.ifscCode);
    setVerified({
      accountNumber: r.accountNumber,
      ifscCode: r.ifscCode,
      name: r.name,
      bankName: r.bankName,
      branch: r.branch,
    });
    setError("");
  };

  const canProceed = verified && !verifying;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase mb-1">
          Step 2 of 4
        </p>
        <h2 className="text-2xl font-bold text-white">Receiver Details</h2>
        <p className="text-sm text-slate-400 mt-1">Enter the account you want to send money to</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Account Number Input */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1.5">
            Account Number
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="10-digit account number"
            value={accountNumber}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white font-mono text-lg tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
          />
        </div>

        {/* IFSC Code */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1.5">IFSC Code</label>
          <input
            type="text"
            placeholder="e.g. SBIN0001234"
            value={ifscCode}
            onChange={(e) => handleIfscChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white font-mono tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors uppercase"
          />
        </div>

        {/* Verification Status */}
        {verifying && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-950/30 border border-blue-700/30">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-blue-300 text-sm">Verifying account...</span>
          </div>
        )}

        {verified && !verifying && (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-700/40">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-emerald-400 text-sm font-semibold">Account Verified</span>
            </div>
            <p className="text-white font-semibold text-base">{verified.name}</p>
            <p className="text-slate-400 text-sm mt-0.5">
              {verified.bankName}
              {verified.branch ? ` • ${verified.branch}` : ""}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-700/40">
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        )}

        {/* Recent Contacts */}
        <div>
          <p className="text-xs text-slate-500 font-medium mb-2">Recent Contacts</p>
          <div className="space-y-2">
            {MOCK_RECEIVERS.slice(0, 4).map((r) => (
              <button
                key={r.accountNumber}
                onClick={() => handleRecentContact(r)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/40 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {r.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{r.name}</p>
                  <p className="text-slate-500 text-xs">{r.bankName}</p>
                </div>
                <p className="text-slate-600 text-xs font-mono">
                  ••{r.accountNumber.slice(-4)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-2xl border border-slate-700 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={() => canProceed && onNext(verified!)}
          disabled={!canProceed}
          className={`flex-[2] py-3.5 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] ${
            canProceed
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500"
              : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
          }`}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
