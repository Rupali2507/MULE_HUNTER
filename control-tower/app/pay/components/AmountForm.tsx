"use client";

import { useState } from "react";

const QUICK_AMOUNTS = [100, 500, 1000, 5000, 10000];
const PURPOSES = [
  "Rent",
  "Bill Payment",
  "Personal Transfer",
  "Business Payment",
  "Loan Repayment",
  "Other",
];

interface AmountData {
  amount: number;
  purpose: string;
  note: string;
}

interface AmountFormProps {
  availableBalance: number;
  receiverName: string;
  onNext: (data: AmountData) => void;
  onBack: () => void;
}

export function AmountForm({
  availableBalance,
  receiverName,
  onNext,
  onBack,
}: AmountFormProps) {
  const [amountStr, setAmountStr] = useState("");
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");

  const amount = parseFloat(amountStr) || 0;
  const exceedsBalance = amount > availableBalance;
  const canProceed = amount > 0 && amount <= availableBalance && purpose;

  const handleAmountChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, "");
    // Allow only one decimal point
    const parts = clean.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setAmountStr(clean);
  };

  const handleQuickAmount = (v: number) => {
    setAmountStr(String(v));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase mb-1">
          Step 3 of 4
        </p>
        <h2 className="text-2xl font-bold text-white">Amount & Purpose</h2>
        <p className="text-sm text-slate-400 mt-1">
          Sending to{" "}
          <span className="text-white font-medium">{receiverName}</span>
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto">
        {/* Amount Input */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-2">Amount</label>
          <div
            className={`flex items-center gap-2 bg-slate-800 border rounded-2xl px-5 py-4 transition-colors ${
              exceedsBalance
                ? "border-red-500/60"
                : "border-slate-700 focus-within:border-emerald-500"
            }`}
          >
            <span className="text-2xl font-bold text-slate-400">₹</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amountStr}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="flex-1 bg-transparent text-3xl font-bold text-white placeholder:text-slate-700 focus:outline-none"
            />
          </div>
          {exceedsBalance && (
            <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Insufficient balance (Available: ₹{availableBalance.toLocaleString("en-IN")})
            </p>
          )}
        </div>

        {/* Quick Select Pills */}
        <div>
          <p className="text-xs text-slate-500 font-medium mb-2">Quick Select</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                onClick={() => handleQuickAmount(v)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  amount === v
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700 hover:border-emerald-600/50 hover:text-white"
                }`}
              >
                ₹{v.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>

        {/* Purpose Dropdown */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1.5">Purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="" disabled className="text-slate-500">
              Select purpose
            </option>
            {PURPOSES.map((p) => (
              <option key={p} value={p} className="bg-slate-800">
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs text-slate-400 font-medium mb-1.5">
            Add a message{" "}
            <span className="text-slate-600">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Thanks for the dinner!"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 100))}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
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
          onClick={() => canProceed && onNext({ amount, purpose, note })}
          disabled={!canProceed}
          className={`flex-[2] py-3.5 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] ${
            canProceed
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500"
              : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
          }`}
        >
          Review →
        </button>
      </div>
    </div>
  );
}
