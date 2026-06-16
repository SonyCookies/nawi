"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { db, type Debt } from "../lib/db";
import { getBankTheme, getInitials } from "./views/WalletView";

interface RecordDebtPaymentModalProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  onRecorded: () => void;
}

function formatCurrency(amount: number, currency = "PHP") {
  const sym = currency === "PHP" ? "₱" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  return `${sym}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function RecordDebtPaymentModal({
  debt,
  isOpen,
  onClose,
  onRecorded,
}: RecordDebtPaymentModalProps) {
  const [amountPaid, setAmountPaid] = useState("");
  const [category, setCategory] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categories, setCategories] = useState<{ id?: number; name: string }[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Side panel account selector states
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_balances") === "true";
    }
    return false;
  });

  const remaining = debt ? debt.amount - debt.paidAmount : 0;

  useEffect(() => {
    if (!isOpen) return;
    db.categories.where("type").equals("expense").toArray().then((cats) => {
      db.categories.toArray().then((all) => {
        const expense = all.filter((c) => !c.type || c.type === "expense");
        setCategories(expense);
      });
    });
    db.accounts.toArray().then((accs) => {
      const sorted = accs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setAccounts(sorted);
    });
  }, [isOpen]);

  // Pre-fill full remaining amount by default when modal opens
  useEffect(() => {
    if (isOpen && debt) {
      const rem = debt.amount - debt.paidAmount;
      setAmountPaid(rem > 0 ? rem.toString() : "");
    }
  }, [isOpen, debt]);

  const handleClose = () => {
    setAmountPaid("");
    setCategory("");
    setAccountId("");
    setIsAccountSelectorOpen(false);
    setAccountSearch("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || !amountPaid || !accountId) return;
    setLoading(true);

    try {
      const paid = parseFloat(amountPaid);
      const newPaid = Math.min((debt.paidAmount ?? 0) + paid, debt.amount);
      const isFullyPaid = newPaid >= debt.amount;
      const account = accounts.find((a) => a.id === parseInt(accountId));

      // 1. Update the debt record with payment log
      const currentHistory = debt.history || [
        {
          type: "creation",
          amount: debt.amount,
          date: debt.createdAt,
          note: debt.description || "Initial balance created"
        }
      ];

      await db.debts.update(debt.id!, {
        paidAmount: newPaid,
        status: isFullyPaid ? "paid" : "partially-paid",
        history: [
          ...currentHistory,
          {
            type: "payment",
            amount: paid,
            date: new Date(),
            note: `Paid to lender`,
            category: category || undefined,
            accountId: parseInt(accountId),
            accountName: account?.name,
          }
        ]
      });

      // 2. Create an expense transaction
      await db.transactions.add({
        type: "expense",
        amount: paid,
        description: `Debt Payment to ${debt.personName}${debt.description ? ` – ${debt.description}` : ""}`,
        fromAccountId: parseInt(accountId),
        fromAccountName: account?.name,
        date: new Date(),
        category: category || undefined,
      });

      // 3. Update account balance (deduct)
      if (account) {
        await db.accounts.update(parseInt(accountId), {
          balance: account.balance - paid,
        });
      }

      onRecorded();
      handleClose();
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Payment Recorded",
          description: `Successfully paid ₱${paid.toLocaleString("en-US", { minimumFractionDigits: 2 })} to ${debt.personName}.`,
          type: "success"
        }
      }));
    } catch (error) {
      console.error("Error recording payment:", error);
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Error",
          description: "Failed to record payment.",
          type: "error"
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !debt) return null;

  const progressPct = debt.amount > 0
    ? Math.round(((debt.paidAmount ?? 0) / debt.amount) * 100)
    : 0;

  const selectedAccount = accounts.find((a) => a.id?.toString() === accountId);
  const selectedAccountTheme = selectedAccount
    ? getBankTheme(selectedAccount.bank, selectedAccount.name, accounts.indexOf(selectedAccount))
    : null;

  const filteredAccounts = accounts.filter((acc) =>
    acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
    acc.type.toLowerCase().includes(accountSearch.toLowerCase()) ||
    (acc.bank && acc.bank.toLowerCase().includes(accountSearch.toLowerCase()))
  );

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div
        className="w-full max-w-[500px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5 max-w-[90%]">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Record payment</h2>
            <p className="text-gray-500 text-sm leading-relaxed mt-1">
              To <span className="font-semibold text-gray-700">{debt.personName}</span> · Remaining:{" "}
              <span className="font-bold text-purple-700">
                ₱{remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-gray-100/80 rounded-xl p-3 shadow-sm">
          <div className="flex justify-between text-xs font-semibold text-gray-500">
            <span>Paid so far</span>
            <span className="text-purple-700">{progressPct}% of ₱{debt.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Amount Paid Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Amount paid</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={remaining}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder={`Up to ₱${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-955 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Account Selector Button */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Pay from account</label>
            <button
              type="button"
              onClick={() => setIsAccountSelectorOpen(true)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium flex justify-between items-center hover:border-purple-500/50 shadow-sm cursor-pointer"
            >
              {selectedAccount && selectedAccountTheme ? (
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${selectedAccountTheme.image ? "bg-white shadow-sm" : "bg-white/20"}`}>
                    {selectedAccountTheme.image ? (
                      <img src={selectedAccountTheme.image} alt={selectedAccount.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-[9px]">{getInitials(selectedAccount.name)}</span>
                    )}
                  </div>
                  <span className="truncate text-sm font-bold text-gray-800">{selectedAccount.name}</span>
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Select account</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Category selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Expense category <span className="font-normal text-gray-400 text-xs">(optional)</span></label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-955 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-3 mt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !accountId || !amountPaid}
              className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center justify-center shrink-0">
                <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <span>{loading ? "Recording..." : "Record payment"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Account Selection Side Panel Drawer */}
      {isAccountSelectorOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/15 backdrop-blur-[2px] transition-all duration-300 animate-fadeIn"
          onClick={() => {
            setIsAccountSelectorOpen(false);
            setAccountSearch("");
          }}
        >
          <div
            className="fixed top-0 right-0 h-full w-full max-w-[430px] bg-white/95 backdrop-blur-2xl border-l border-gray-100 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col p-6 gap-5 animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold text-gray-900 leading-none">Select Account</h3>
                <p className="text-xs text-gray-400">Choose source account for payment.</p>
              </div>
              <button
                onClick={() => {
                  setIsAccountSelectorOpen(false);
                  setAccountSearch("");
                }}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border border-gray-100 cursor-pointer animate-rotateIn"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search accounts by name or bank..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-955 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              />
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
                </svg>
              </div>
              {accountSearch && (
                <button
                  onClick={() => setAccountSearch("")}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List of accounts cards */}
            <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-3.5 select-none [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
              {filteredAccounts.map((acc, idx) => {
                const theme = getBankTheme(acc.bank, acc.name, idx);
                const isSelected = accountId === acc.id?.toString();
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      setAccountId(isSelected ? "" : (acc.id?.toString() || ""));
                      setIsAccountSelectorOpen(false);
                      setAccountSearch("");
                    }}
                    className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br ${theme.gradient} ${theme.textColor} shadow-lg flex flex-col justify-between h-44 shrink-0 transition-all duration-200 cursor-pointer border-2 active:scale-[0.98] ${
                      isSelected
                        ? "border-purple-600 ring-4 ring-purple-600/35 scale-[1.01]"
                        : "border-transparent opacity-90 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${theme.image ? "bg-white shadow-sm" : "bg-white/20"}`}>
                          {theme.image ? (
                            <img src={theme.image} alt={acc.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-sm">{getInitials(acc.name)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <div className="text-base font-bold truncate max-w-[200px]" title={acc.name}>{acc.name}</div>
                          <div className={`text-[11px] ${theme.subtextColor} truncate`}>{acc.type} • {acc.currency}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isSelected && (
                          <CheckIcon className="w-5 h-5 text-white bg-purple-600 rounded-full p-1 shadow-sm shrink-0" strokeWidth={3} />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 w-full">
                      {acc.type === "Credit" ? (
                        <>
                          <div className="flex justify-between items-end">
                            <div>
                              <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                                Used Credit
                              </div>
                              <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(-Math.abs(acc.balance))}</div>
                            </div>
                            {acc.creditLimit !== undefined && acc.creditLimit > 0 && (
                              <div className="text-right">
                                <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                                  Available Credit
                                </div>
                                <div className={`text-sm font-bold truncate transition-all duration-300 ${isHidden ? "blur-sm select-none pointer-events-none" : ""}`}>
                                  {formatCurrency(acc.creditLimit - Math.abs(acc.balance))}
                                </div>
                              </div>
                            )}
                          </div>
                          {acc.creditLimit !== undefined && acc.creditLimit > 0 && (
                            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div
                                className="bg-white h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, (Math.abs(acc.balance) / acc.creditLimit) * 100)}%` }}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                            Balance
                          </div>
                          <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(acc.balance)}</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredAccounts.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-400 font-medium italic">
                  No accounts match &quot;{accountSearch}&quot;.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
