"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, CheckIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { db, type Account } from "../lib/db";

interface PaylaterDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSaved?: () => void;
}

function formatCurrency(amount: number, currency = "PHP") {
  const sym = currency === "PHP" ? "₱" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  return `${sym}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function nextPaymentDate(dueDay: number, monthOffset: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Calculate candidate date for the current/offset month
  let targetMonth = month + monthOffset;
  let targetYear = year;
  
  if (targetMonth > 11) {
    targetYear += Math.floor(targetMonth / 12);
    targetMonth = targetMonth % 12;
  }
  
  const candidate = new Date(targetYear, targetMonth, dueDay);
  if (monthOffset === 0 && candidate <= now) {
    // If we're looking at offset 0 and it's already passed today, push to next month
    return nextPaymentDate(dueDay, 1);
  }
  
  return candidate;
}

export default function PaylaterDetailModal({ isOpen, onClose, account, onSaved }: PaylaterDetailModalProps) {
  const [termMonths, setTermMonths] = useState<number>(3);
  const [payments, setPayments] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (account) {
      const savedPayments = account.customInstallmentPayments;
      const savedTerm = account.installmentTermMonths || 3;
      if (savedPayments && savedPayments.length === savedTerm) {
        setPayments(savedPayments.map(p => p.toFixed(2)));
        setTermMonths(savedTerm);
      } else {
        setTermMonths(savedTerm);
        const defaultAmount = (Math.abs(account.balance) / savedTerm).toFixed(2);
        setPayments(Array(savedTerm).fill(defaultAmount));
      }
    }
  }, [account]);

  if (!isOpen || !account) return null;

  const currentBalance = Math.abs(account.balance);
  const dueDay = account.paymentDueDay || 15;

  const handleTermChange = (newTerm: number) => {
    setTermMonths(newTerm);
    const defaultAmount = (currentBalance / newTerm).toFixed(2);
    setPayments(Array(newTerm).fill(defaultAmount));
  };

  const handleQuickSelect = (months: number) => {
    handleTermChange(months);
  };

  const handleCustomChange = (val: string) => {
    const parsed = parseInt(val);
    if (!isNaN(parsed) && parsed > 0) {
      handleTermChange(parsed);
    } else if (val === "") {
      setTermMonths(0);
      setPayments([]);
    }
  };

  const handleAmountChangeForMonth = (idx: number, val: string) => {
    let clean = val.replace(/[^\d.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    const updated = [...payments];
    updated[idx] = clean;
    setPayments(updated);
  };

  const handleBlurMonth = (idx: number) => {
    const updated = [...payments];
    const val = parseFloat(updated[idx]) || 0;
    updated[idx] = val.toFixed(2);
    setPayments(updated);
  };

  const handleSave = async () => {
    if (!account.id) return;
    setIsSaving(true);
    try {
      const numericPayments = payments.map(p => parseFloat(p) || 0);
      await db.accounts.update(account.id, {
        installmentTermMonths: termMonths,
        customInstallmentPayments: numericPayments
      });
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: { 
          title: "Installments Updated", 
          description: `${account.name} term and custom monthly payments saved.`, 
          type: "success" 
        }
      }));
      onSaved?.();
      onClose();
    } catch (e) {
      console.error("Error saving installment term:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const totalScheduled = payments.reduce((sum, p) => sum + (parseFloat(p) || 0), 0);
  const diff = currentBalance - totalScheduled;

  // Generate the installment breakdown schedule
  const schedule = Array.from({ length: termMonths }).map((_, index) => {
    const payDate = nextPaymentDate(dueDay, index);
    const amtStr = payments[index] || "0.00";
    return {
      monthNumber: index + 1,
      dueDate: payDate,
      amountStr: amtStr
    };
  });

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] animate-fadeIn select-none">
      <div
        className="w-full max-w-[640px] bg-white/85 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 flex flex-col gap-5 relative max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start shrink-0">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Installment Details</h2>
            <p className="text-sm text-gray-400">Configure terms and see monthly breakdown for {account.name}.</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Account Info and Debt Card */}
        <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-100/50 rounded-2xl p-4 flex justify-between items-center shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-purple-500 font-normal mb-0.5">
              Outstanding Debt
            </div>
            <div className="text-2xl font-black text-gray-950">
              {formatCurrency(currentBalance, account.currency)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-normal mb-0.5">
              Due Day
            </div>
            <div className="text-lg font-bold text-purple-600">
              Day {dueDay} of month
            </div>
          </div>
        </div>

        {/* Installment Term Editing */}
        <div className="flex flex-col gap-3 shrink-0">
          <label className="text-sm font-medium text-gray-500">Configure Installment Term</label>
          
          {/* Quick selectors */}
          <div className="flex gap-2">
            {[1, 3, 6, 12, 24].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleQuickSelect(m)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                  termMonths === m
                    ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/10"
                    : "bg-white border-gray-100 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {m}mo
              </button>
            ))}
          </div>

          {/* Custom Months Input */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xs text-gray-400">Custom Months</span>
              <input
                type="number"
                min="1"
                max="120"
                value={termMonths || ""}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-900 font-semibold placeholder-gray-300 focus:outline-none focus:border-purple-500/50 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Allocation status and Autobalance */}
        <div className="flex justify-between items-center px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs shrink-0 select-none">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-medium">Total Scheduled: {formatCurrency(totalScheduled, account.currency)}</span>
            {Math.abs(diff) < 0.01 ? (
              <span className="text-emerald-600 font-semibold">✓ Balanced exactly</span>
            ) : diff > 0 ? (
              <span className="text-amber-600 font-semibold">{formatCurrency(diff, account.currency)} left to allocate</span>
            ) : (
              <span className="text-red-500 font-semibold">Over-allocated by {formatCurrency(Math.abs(diff), account.currency)}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {Math.abs(diff) >= 0.01 && (
              <button
                type="button"
                onClick={async () => {
                  await db.accounts.update(account.id!, { balance: totalScheduled });
                  window.dispatchEvent(new CustomEvent("show_toast", {
                    detail: { 
                      title: "Balance Adjusted", 
                      description: `${account.name} balance adjusted to match total scheduled (₱${totalScheduled.toFixed(2)}).`, 
                      type: "success" 
                    }
                  }));
                  onSaved?.();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 font-semibold transition-all cursor-pointer animate-fadeIn"
              >
                Adjust Balance to Match Total
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const defaultAmount = (currentBalance / termMonths).toFixed(2);
                setPayments(Array(termMonths).fill(defaultAmount));
              }}
              className="px-3 py-1.5 rounded-xl border border-purple-100 hover:border-purple-200 text-purple-600 hover:bg-purple-50 font-semibold transition-all cursor-pointer"
            >
              Reset to Equal
            </button>
          </div>
        </div>

        {/* Schedule Preview Section with Inputs */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-normal shrink-0">
            Customize Monthly Amounts
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
            {schedule.map((item, index) => (
              <div
                key={item.monthNumber}
                className="flex items-center justify-between p-3 bg-gray-50/70 border border-gray-100/50 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-50 border border-purple-100/40 flex items-center justify-center text-purple-600 text-xs font-bold">
                    {item.monthNumber}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">
                      Month {item.monthNumber} of {termMonths}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-gray-300" />
                      Due on {item.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>
                {/* Editable payment amount input */}
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₱</span>
                  <input
                    type="text"
                    value={item.amountStr}
                    onChange={(e) => handleAmountChangeForMonth(index, e.target.value)}
                    onBlur={() => handleBlurMonth(index)}
                    className="w-full bg-white border border-gray-100 rounded-xl pl-7 pr-3 py-2 text-sm font-bold text-gray-800 text-right focus:outline-none focus:border-purple-500/50 shadow-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-1 shrink-0 pt-2 border-t border-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white border border-gray-100 text-gray-700 font-semibold text-base shadow-sm hover:bg-gray-50 transition-all cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || termMonths <= 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-base rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="w-5 h-5" strokeWidth={2.5} />
            Save Layout
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
