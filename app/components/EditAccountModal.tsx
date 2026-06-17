"use client";

import { useState } from "react";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { db, type Account } from "../lib/db";
import { SUPPORTED_BANKS } from "./AddAccountModal";

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

export default function EditAccountModal({ isOpen, onClose, account }: EditAccountModalProps) {
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState(account?.type || "Debit");
  const [currency, setCurrency] = useState(account?.currency || "PHP");
  const [includeInTotals, setIncludeInTotals] = useState(account?.includeInTotals !== false);
  const [bank, setBank] = useState(() => {
    if (account?.bank) return account.bank;
    if (account?.name) {
      const lower = account.name.toLowerCase();
      for (const b of SUPPORTED_BANKS) {
        if (b.keywords.some(kw => lower.includes(kw))) {
          return b.id;
        }
      }
    }
    return "other";
  });
  const [isBankManuallySelected, setIsBankManuallySelected] = useState(false);
  const [creditLimit, setCreditLimit] = useState(() => {
    if (account?.creditLimit !== undefined) {
      const val = account.creditLimit;
      const integerPart = Math.floor(val).toString();
      const decimalPart = (val % 1).toFixed(2).substring(1);
      const num = parseFloat(integerPart);
      if (!isNaN(num)) {
        return num.toLocaleString("en-US") + (decimalPart === ".00" ? "" : decimalPart);
      }
      return val.toString();
    }
    return "";
  });

  const [balance, setBalance] = useState(() => {
    if (!account) return "";
    const val = account.balance;
    const integerPart = Math.floor(val).toString();
    const decimalPart = (val % 1).toFixed(2).substring(1); // e.g. ".50"
    
    const num = parseFloat(integerPart);
    if (!isNaN(num)) {
      return num.toLocaleString("en-US") + (decimalPart === ".00" ? "" : decimalPart);
    }
    return val.toString();
  });

  const [earnsInterest, setEarnsInterest] = useState(account?.earnsInterest || false);
  const [interestRate, setInterestRate] = useState(account?.interestRate?.toString() || "");
  const [taxRate, setTaxRate] = useState(account?.taxRate?.toString() || "20.0");
  const [paymentDueDay, setPaymentDueDay] = useState(account?.paymentDueDay?.toString() || "");
  const [installmentTermMonths, setInstallmentTermMonths] = useState(account?.installmentTermMonths?.toString() || "3");

  const handleSave = async () => {
    if (!name.trim() || !account?.id) return;
    try {
      const isLiability = type === "Credit" || type === "Paylater";
      const isCredit = type === "Credit";
      const isPaylater = type === "Paylater";
      const earns = !isLiability && earnsInterest;
      await db.accounts.update(account.id, {
        name: name.trim(),
        type,
        balance: parseFloat(balance.replace(/,/g, "")) || 0,
        currency,
        includeInTotals,
        bank,
        creditLimit: (isCredit || isPaylater) ? (parseFloat(creditLimit.replace(/,/g, "")) || 0) : undefined,
        paymentDueDay: (isCredit || isPaylater) && paymentDueDay ? (parseInt(paymentDueDay) || undefined) : undefined,
        installmentTermMonths: isPaylater ? (parseInt(installmentTermMonths) || 3) : undefined,
        earnsInterest: earns,
        interestRate: earns ? (parseFloat(interestRate) || 0) : undefined,
        taxRate: earns ? (parseFloat(taxRate) || 0) : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Error updating account:", error);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    
    // Auto-detect bank from name if the user hasn't manually selected one yet
    if (!isBankManuallySelected) {
      const lower = val.toLowerCase();
      let matched = "other";
      for (const b of SUPPORTED_BANKS) {
        if (b.keywords.some(kw => lower.includes(kw))) {
          matched = b.id;
          break;
        }
      }
      setBank(matched);
    }
  };

  const handleBalanceChange = (val: string) => {
    if (val === "") {
      setBalance("");
      return;
    }

    let clean = val.replace(/[^\d.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    
    const integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? "." + parts[1] : "";
    
    if (integerPart) {
      const num = parseFloat(integerPart.replace(/,/g, ""));
      if (!isNaN(num)) {
        setBalance(num.toLocaleString("en-US") + decimalPart);
        return;
      }
    }
    setBalance(clean);
  };

  const handleCreditLimitChange = (val: string) => {
    if (val === "") {
      setCreditLimit("");
      return;
    }
    let clean = val.replace(/[^\d.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    const integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? "." + parts[1] : "";
    if (integerPart) {
      const num = parseFloat(integerPart.replace(/,/g, ""));
      if (!isNaN(num)) {
        setCreditLimit(num.toLocaleString("en-US") + decimalPart);
        return;
      }
    }
    setCreditLimit(clean);
  };

  if (!isOpen || !account) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="w-full max-w-[550px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5 max-w-[90%]">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Edit account</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Update your account details to immediately refresh your wallet balances and totals.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          {/* Institution Selector */}
          <div className="col-span-full flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Institution</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-100 rounded-xl max-h-[140px] overflow-y-auto">
              {SUPPORTED_BANKS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBank(bank === b.id ? "other" : b.id);
                    setIsBankManuallySelected(true);
                  }}
                  className={`w-10 h-10 rounded-full bg-white overflow-hidden flex items-center justify-center border-2 transition-all cursor-pointer shadow-sm relative shrink-0 ${
                    bank === b.id 
                      ? "border-transparent ring-4 ring-purple-600 scale-110 z-10" 
                      : "border-gray-100 hover:border-gray-300"
                  }`}
                  title={b.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image} alt={b.name} className="w-full h-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setBank("other");
                  setIsBankManuallySelected(true);
                }}
                className={`px-3.5 h-10 rounded-full bg-white text-xs font-bold transition-all cursor-pointer shadow-sm border-2 shrink-0 ${
                  bank === "other"
                    ? "border-purple-600 text-purple-700 bg-purple-50/50"
                    : "border-gray-100 hover:border-gray-300 text-gray-500"
                }`}
              >
                Other
              </button>
            </div>
          </div>

          {/* Name Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="BPI Savings"
            />
          </div>

          {/* Type Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Type</label>
            <div className="relative">
              <select 
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
              >
                <option value="Debit">Debit</option>
                <option value="Credit">Credit</option>
                <option value="Paylater">Paylater</option>
                <option value="Savings">Savings</option>
                <option value="Investment">Investment</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Balance Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Balance</label>
            <input 
              type="text" 
              value={balance}
              onChange={(e) => handleBalanceChange(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="0.00"
            />
          </div>

          {/* Currency Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Currency</label>
            <div className="relative">
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Credit & Paylater fields */}
          {(type === "Credit" || type === "Paylater") && (
            <>
              <div className="flex flex-col gap-2 col-span-full md:col-span-1 animate-fadeInSimple">
                <label className="text-sm font-medium tracking-wide text-gray-500">{type === "Paylater" ? "Account Limit" : "Credit Limit"}</label>
                <input 
                  type="text" 
                  value={creditLimit}
                  onChange={(e) => handleCreditLimitChange(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
                  placeholder="50,000.00"
                />
              </div>
              <div className="flex flex-col gap-2 col-span-full md:col-span-1 animate-fadeInSimple">
                <label className="text-sm font-medium tracking-wide text-gray-500">Payment Due Day <span className="text-gray-300 text-xs">(day of month)</span></label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
                />
              </div>
            </>
          )}
        </div>

        {/* Daily Interest Settings — only for non-liability accounts */}
        {type !== "Credit" && type !== "Paylater" && (
          <div className="flex flex-col gap-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl p-4 transition-all duration-300">
            <div 
              onClick={() => setEarnsInterest(!earnsInterest)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-950">Earns Daily Interest</span>
                <span className="text-xs text-gray-400">Automatically compound interest daily.</span>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${earnsInterest ? "bg-purple-600" : "bg-gray-200"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${earnsInterest ? "translate-x-5" : "translate-x-0"}`} />
              </div>
            </div>

            {earnsInterest && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100/80 animate-fadeInSimple">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Annual Interest Rate (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    placeholder="3.25"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-950 font-semibold focus:outline-none focus:border-purple-500/50 shadow-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Withholding Tax (%)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    placeholder="20.0"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-950 font-semibold focus:outline-none focus:border-purple-500/50 shadow-sm"
                  />
                </div>
                
                {/* Live Preview / Value Check */}
                <div className="col-span-full bg-purple-50/50 border border-purple-100/30 rounded-xl p-3 flex flex-col gap-1 mt-1">
                  <div className="text-[11px] text-purple-700 uppercase tracking-wider">Daily Earnings Estimate</div>
                  <div className="text-lg font-black text-purple-950">
                    {(() => {
                      const balVal = parseFloat(balance.replace(/,/g, "")) || 0;
                      const rateVal = parseFloat(interestRate) || 0;
                      const taxVal = parseFloat(taxRate) || 0;
                      if (balVal <= 0 || rateVal <= 0) {
                        return "₱0.00";
                      }
                      const est = (balVal * (rateVal / 100) / 365) * (1 - taxVal / 100);
                      const rounded = Math.round(est * 100) / 100;
                      if (rounded < 0.01) {
                        return "Less than ₱0.01 (Transactions won't accrue daily)";
                      }
                      return `₱${rounded.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    })()}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">
                    Based on your current balance of ₱{parseFloat(balance.replace(/,/g, "") || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}.
                  </div>
                </div>

                <div className="col-span-2 text-[11px] text-gray-400 leading-normal font-medium italic">
                  Formula: (Balance × Rate / 365) × (1 - Tax / 100). Credited daily if interest is at least ₱0.01.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checkbox Section */}
        <div 
          onClick={() => setIncludeInTotals(!includeInTotals)}
          className="flex items-center gap-3 w-full bg-white border border-gray-100/80 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-all duration-200 shadow-sm"
        >
          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all duration-150 ${includeInTotals ? "bg-purple-600 border-purple-600 text-white" : "border-gray-300 bg-white"}`}>
            {includeInTotals && (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700">Include this account in wallet totals</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end items-center gap-3 mt-1">
          <button 
            onClick={onClose}
            className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-center shrink-0">
              <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <span>Save changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
