"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account, type ScheduledItem } from "../lib/db";
import { getBankTheme, getInitials } from "./views/WalletView";

interface RecordScheduledPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ScheduledItem | null;
  onSaved?: () => void;
}

export default function RecordScheduledPaymentModal({ isOpen, onClose, item, onSaved }: RecordScheduledPaymentModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [datetime, setDatetime] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  const accounts = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }) || [];

  const categories = useLiveQuery(() => {
    if (item) {
      return db.categories.where("type").equals(item.type).toArray();
    }
    return db.categories.toArray();
  }, [item?.type]) || [];

  // Filter bank/cash accounts (exclude credit/paylater liabilities)
  const sourceAccounts = accounts.filter(
    (acc) => acc.type !== "Credit" && acc.type !== "Paylater"
  );

  const filteredSourceAccounts = sourceAccounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.bank && acc.bank.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Sync state when modal opens or item changes
  useEffect(() => {
    if (isOpen && item) {
      setAmount(item.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setDescription(item.description);
      setCategory(item.category || "");
      setSelectedAccountId(""); // Reset account to force auto-selection
      // Reset datetime to current local time
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setDatetime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    }
  }, [isOpen, item?.id]);

  // Fallback to first category if none is set on the item and categories are loaded
  useEffect(() => {
    if (isOpen && !item?.category && categories.length > 0 && !category) {
      setCategory(categories[0].name);
    }
  }, [isOpen, item?.category, categories, category]);

  // Handle default account selection once accounts are loaded
  useEffect(() => {
    if (isOpen && accounts.length > 0 && !selectedAccountId) {
      const bankAccounts = accounts.filter(
        (acc) => acc.type !== "Credit" && acc.type !== "Paylater"
      );
      if (bankAccounts.length > 0) {
        setSelectedAccountId(bankAccounts[0].id?.toString() || "");
      }
    }
  }, [isOpen, accounts, selectedAccountId]);

  if (!isOpen || !item) return null;

  const isExpense = item.type === "expense";

  const handleAmountChange = (val: string) => {
    if (val === "") {
      setAmount("");
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
        setAmount(num.toLocaleString("en-US") + decimalPart);
        return;
      }
    }
    setAmount(clean);
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount.replace(/,/g, ""));
    const accountId = parseInt(selectedAccountId);

    if (!accountId || isNaN(numAmount) || numAmount <= 0 || !item.id) return;

    setIsSaving(true);

    try {
      const targetAcc = await db.accounts.get(accountId);
      if (!targetAcc) {
        setIsSaving(false);
        return;
      }

      // If expense, check if account balance would fall below 0
      if (isExpense && targetAcc.balance - numAmount < 0) {
        window.dispatchEvent(new CustomEvent("show_toast", { 
          detail: { 
            title: "Insufficient Funds", 
            description: `Cannot record payment. ${targetAcc.name} balance would fall below 0.`, 
            type: "error" 
          } 
        }));
        setIsSaving(false);
        return;
      }

      await db.transaction("rw", [db.accounts, db.transactions, db.scheduledItems], async () => {
        // 1. Update account balance
        const updatedBalance = isExpense 
          ? targetAcc.balance - numAmount 
          : targetAcc.balance + numAmount;
        await db.accounts.update(accountId, { balance: updatedBalance });

        // 2. Calculate current net worth
        const allAccs = await db.accounts.toArray();
        const currentNetWorth = allAccs
          .filter((acc) => acc.includeInTotals)
          .reduce((sum, acc) => sum + (acc.type === "Credit" || acc.type === "Paylater" ? -Math.abs(acc.balance) : acc.balance), 0);

        // 3. Log transaction
        if (isExpense) {
          await db.transactions.add({
            type: "expense",
            amount: numAmount,
            description: description.trim() || item.description,
            fromAccountId: accountId,
            fromAccountName: targetAcc.name,
            date: new Date(datetime),
            category: category.trim() || "Bills",
            netWorth: currentNetWorth,
            fromAccountBalance: updatedBalance
          });
        } else {
          await db.transactions.add({
            type: "income",
            amount: numAmount,
            description: description.trim() || item.description,
            toAccountId: accountId,
            toAccountName: targetAcc.name,
            date: new Date(datetime),
            category: category.trim() || item.category || "Other Income",
            netWorth: currentNetWorth,
            toAccountBalance: updatedBalance
          });
        }

        // 4. Advance nextDueDate
        const currentDueDate = item.nextDueDate ? new Date(item.nextDueDate) : null;
        let nextDate: Date | undefined = undefined;
        if (currentDueDate) {
          nextDate = new Date(currentDueDate);
          if (item.interval === "monthly") {
            nextDate.setMonth(nextDate.getMonth() + 1);
          } else if (item.interval === "weekly") {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (item.interval === "yearly") {
            nextDate.setFullYear(nextDate.getFullYear() + 1);
          }
        }
        const isActive = item.interval !== "one-time";

        await db.scheduledItems.update(item.id!, {
          nextDueDate: nextDate,
          isActive: isActive
        });
      });

      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: isExpense ? "Expense Logged" : "Income Logged", 
          description: `${isExpense ? "Paid" : "Received"} ₱${numAmount.toLocaleString()} - ${description}`, 
          type: "success" 
        } 
      }));

      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Error logging transaction:", err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Error", 
          description: "Failed to record transaction.", 
          type: "error" 
        } 
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const selectedAccount = sourceAccounts.find((a) => a.id?.toString() === selectedAccountId);
  const selectedTheme = selectedAccount
    ? getBankTheme(selectedAccount.bank, selectedAccount.name, accounts.indexOf(selectedAccount))
    : null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] animate-fadeIn select-none">
      <div
        className="w-full max-w-[480px] bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 flex flex-col gap-5 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">
              {isExpense ? "Confirm Expense Payment" : "Confirm Income Receipt"}
            </h2>
            <p className="text-sm text-gray-400">
              Record this transaction and advance the next scheduled date.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Scheduled Item:</span>
            <span className="font-semibold text-gray-800">{item.description}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount:</span>
            <span className={`font-bold ${isExpense ? "text-red-500" : "text-emerald-600"}`}>
              {isExpense ? "-" : "+"}₱{item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Repeats:</span>
            <span className="text-gray-500 capitalize">{item.interval}</span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          
          {/* Account Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500">
              {isExpense ? "Pay From Account" : "Receive Into Account"}
            </label>
            <button
              type="button"
              onClick={() => setIsSelectorOpen(true)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium flex justify-between items-center hover:border-purple-500/50 shadow-sm cursor-pointer"
            >
              {selectedAccount && selectedTheme ? (
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${selectedTheme.image ? "bg-white shadow-sm" : "bg-white/20"}`}>
                    {selectedTheme.image ? (
                      <img src={selectedTheme.image} alt={selectedAccount.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-[9px]">{getInitials(selectedAccount.name)}</span>
                    )}
                  </div>
                  <span className="truncate text-sm font-bold text-gray-800">
                    {selectedAccount.name} <span className="text-xs font-normal text-gray-400">(₱{selectedAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })})</span>
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Select account</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₱</span>
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl pl-7 pr-3 py-3 text-base text-gray-950 font-medium placeholder-gray-300 focus:outline-none focus:border-purple-500/50 shadow-sm"
              />
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Description / Note */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-300 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Date and Time */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-500">Transaction Date</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-1.5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white border border-gray-100 text-gray-700 font-semibold text-base shadow-sm hover:bg-gray-50 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedAccountId || !amount}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-base rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon className="w-5 h-5" strokeWidth={2.5} />
            Confirm
          </button>
        </div>
      </div>

      {/* Account Selection Drawer */}
      {isSelectorOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/15 backdrop-blur-[2px] transition-all duration-300 animate-fadeIn"
          onClick={() => {
            setIsSelectorOpen(false);
            setSearchQuery("");
          }}
        >
          <div 
            className="fixed top-0 right-0 h-full w-full max-w-[430px] bg-white/95 backdrop-blur-2xl border-l border-gray-100 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col p-6 gap-5 animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-center shrink-0">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold text-gray-900 leading-none">Select Account</h3>
                <p className="text-xs text-gray-400">Choose where to process funds.</p>
              </div>
              <button
                onClick={() => {
                  setIsSelectorOpen(false);
                  setSearchQuery("");
                }}
                className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center border border-gray-100 cursor-pointer"
              >
                <XMarkIcon className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <input
                type="text"
                placeholder="Search bank/cash accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              />
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
                </svg>
              </div>
            </div>

            {/* List of accounts */}
            <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-3.5 select-none [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
              {filteredSourceAccounts.map((acc, index) => {
                const theme = getBankTheme(acc.bank, acc.name, index);
                const isSelected = selectedAccountId === acc.id?.toString();
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      setSelectedAccountId(acc.id?.toString() || "");
                      setIsSelectorOpen(false);
                      setSearchQuery("");
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
                          <div className="text-sm font-bold truncate max-w-[150px]">{acc.name}</div>
                          <div className={`text-[10px] ${theme.subtextColor} truncate`}>{acc.type} • {acc.currency}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckIcon className="w-4 h-4 text-white bg-purple-600 rounded-full p-0.5 shadow-sm" strokeWidth={3} />
                      )}
                    </div>
                    <div>
                      <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-1`}>
                        Balance
                      </div>
                      <div className="text-2xl font-black truncate">
                        ₱{acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredSourceAccounts.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-400 font-medium italic">
                  No accounts found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
