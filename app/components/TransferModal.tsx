"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { getBankTheme, getInitials } from "./views/WalletView";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TransferModal({ isOpen, onClose }: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [transferFee, setTransferFee] = useState("");
  const [description, setDescription] = useState("");
  const [treatAsExpense, setTreatAsExpense] = useState(false);
  const [isFromSelectorOpen, setIsFromSelectorOpen] = useState(false);
  const [isToSelectorOpen, setIsToSelectorOpen] = useState(false);
  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [datetime, setDatetime] = useState(() => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_balances") === "true";
    }
    return false;
  });

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsHidden(customEvent.detail);
    };
    window.addEventListener("balance_visibility_changed", handleEvent);
    return () => {
      window.removeEventListener("balance_visibility_changed", handleEvent);
    };
  }, []);

  const formatCurrency = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${val < 0 ? "-" : "+"}₱${formatted}`;
  };

  const formatNetWorth = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${val < 0 ? "-" : ""}₱${formatted}`;
  };

  const accounts = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }) || [];

  // Auto-detect Credit/Paylater accounts to suggest treating as Expense
  useEffect(() => {
    if (!toAccountId) {
      setTreatAsExpense(false);
      return;
    }
    const toAcc = accounts.find(a => a.id?.toString() === toAccountId);
    if (toAcc && (toAcc.type === "Credit" || toAcc.type === "Paylater")) {
      setTreatAsExpense(true);
    } else {
      setTreatAsExpense(false);
    }
  }, [toAccountId, accounts]);

  const handleNumericChange = (val: string, setter: (v: string) => void) => {
    if (val === "") {
      setter("");
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
        setter(num.toLocaleString("en-US") + decimalPart);
        return;
      }
    }
    setter(clean);
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount.replace(/,/g, ""));
    const numFee = parseFloat(transferFee.replace(/,/g, "")) || 0;
    const fromId = parseInt(fromAccountId);
    const toId = parseInt(toAccountId);

    if (!fromId || !toId || isNaN(numAmount) || numAmount <= 0) return;
    if (fromId === toId) return;

    try {
      const fromAcc = await db.accounts.get(fromId);
      const toAcc = await db.accounts.get(toId);
      if (!fromAcc || !toAcc) return;

      if (fromAcc.type === "Credit") {
        const remaining = (fromAcc.creditLimit ?? 0) - fromAcc.balance;
        if (numAmount + numFee > remaining) {
          window.dispatchEvent(new CustomEvent("show_toast", { 
            detail: { 
              title: "Over Credit Limit", 
              description: `Cannot complete transaction. Transfer exceeds remaining credit limit.`, 
              type: "error" 
            } 
          }));
          return;
        }
      } else if (fromAcc.type !== "Paylater" && (fromAcc.balance - numAmount - numFee) < 0) {
        window.dispatchEvent(new CustomEvent("show_toast", { 
          detail: { 
            title: "Insufficient Funds", 
            description: `Cannot complete transaction. Account balance would fall below 0.`, 
            type: "error" 
          } 
        }));
        return;
      }

      await db.transaction("rw", [db.accounts, db.transactions], async () => {
        const updatedFromBalance = fromAcc.type === "Credit" || fromAcc.type === "Paylater"
          ? fromAcc.balance + numAmount + numFee
          : fromAcc.balance - numAmount - numFee;
        const updatedToBalance = toAcc.type === "Credit" || toAcc.type === "Paylater"
          ? toAcc.balance - numAmount
          : toAcc.balance + numAmount;

        // Source account: update balance
        await db.accounts.update(fromId, {
          balance: updatedFromBalance
        });

        // Destination account: update balance
        await db.accounts.update(toId, {
          balance: updatedToBalance
        });

        const allAccs = await db.accounts.toArray();
        const currentNetWorth = allAccs
          .filter((acc) => acc.includeInTotals)
          .reduce((sum, acc) => sum + (acc.type === "Credit" || acc.type === "Paylater" ? -Math.abs(acc.balance) : acc.balance), 0);

        // Save transaction
        await db.transactions.add({
          type: "transfer",
          amount: numAmount,
          transferFee: numFee > 0 ? numFee : undefined,
          description: description.trim() || `Transfer from ${fromAcc.name} to ${toAcc.name}`,
          fromAccountId: fromId,
          toAccountId: toId,
          fromAccountName: fromAcc.name,
          toAccountName: toAcc.name,
          date: new Date(datetime),
          treatAsExpense: treatAsExpense || undefined,
          category: toAcc.type === "Credit" || toAcc.type === "Paylater" ? (toAcc.type === "Credit" ? "Credit Payment" : "Paylater Payment") : undefined,
          netWorth: currentNetWorth,
          fromAccountBalance: updatedFromBalance,
          toAccountBalance: updatedToBalance
        });
      });

      onClose();
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: treatAsExpense ? "Expense Logged" : "Transfer Logged", 
          description: `₱${amount} from ${fromAcc.name} to ${toAcc.name}`, 
          type: "success" 
        } 
      }));
      // Reset
      setFromAccountId("");
      setToAccountId("");
      setAmount("");
      setTransferFee("");
      setDescription("");
      setTreatAsExpense(false);
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setDatetime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    } catch (err) {
      console.error("Error executing transfer:", err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Error", 
          description: "Failed to transfer funds.", 
          type: "error" 
        } 
      }));
    }
  };

  // Show available balance for the selected source account
  const fromAccount = accounts.find(a => a.id?.toString() === fromAccountId);
  const toAccount = accounts.find(a => a.id?.toString() === toAccountId);

  const fromAccountTheme = fromAccount 
    ? getBankTheme(fromAccount.bank, fromAccount.name, accounts.indexOf(fromAccount))
    : null;
  const toAccountTheme = toAccount 
    ? getBankTheme(toAccount.bank, toAccount.name, accounts.indexOf(toAccount))
    : null;

  const filteredFromAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(fromSearch.toLowerCase()) ||
    acc.type.toLowerCase().includes(fromSearch.toLowerCase()) ||
    (acc.bank && acc.bank.toLowerCase().includes(fromSearch.toLowerCase()))
  );

  const filteredToAccounts = accounts
    .filter(acc => acc.id?.toString() !== fromAccountId)
    .filter(acc => 
      acc.name.toLowerCase().includes(toSearch.toLowerCase()) ||
      acc.type.toLowerCase().includes(toSearch.toLowerCase()) ||
      (acc.bank && acc.bank.toLowerCase().includes(toSearch.toLowerCase()))
    );

  const availableLabel = fromAccount
    ? fromAccount.type === "Credit"
      ? `Limit Remaining: ₱${Math.max(0, (fromAccount.creditLimit ?? 0) - fromAccount.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : fromAccount.type === "Paylater"
        ? `Outstanding Debt: ₱${fromAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `Available: ₱${fromAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";

  if (!isOpen) return null;

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
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Add transfer</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Move money between accounts and keep balances in sync with the imported session.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Form Fields - 2 column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">

          {/* From Account Selector Button */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">From Account</label>
            <button
              type="button"
              onClick={() => setIsFromSelectorOpen(true)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium flex justify-between items-center hover:border-purple-500/50 shadow-sm cursor-pointer"
            >
              {fromAccount && fromAccountTheme ? (
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${fromAccountTheme.image ? "bg-white shadow-sm" : "bg-white/20"}`}>
                    {fromAccountTheme.image ? (
                      <img src={fromAccountTheme.image} alt={fromAccount.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-[9px]">{getInitials(fromAccount.name)}</span>
                    )}
                  </div>
                  <span className="truncate text-sm font-bold text-gray-800">{fromAccount.name}</span>
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Select account</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* To Account Selector Button */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">To Account</label>
            <button
              type="button"
              onClick={() => setIsToSelectorOpen(true)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium flex justify-between items-center hover:border-purple-500/50 shadow-sm cursor-pointer"
            >
              {toAccount && toAccountTheme ? (
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${toAccountTheme.image ? "bg-white shadow-sm" : "bg-white/20"}`}>
                    {toAccountTheme.image ? (
                      <img src={toAccountTheme.image} alt={toAccount.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-[9px]">{getInitials(toAccount.name)}</span>
                    )}
                  </div>
                  <span className="truncate text-sm font-bold text-gray-800">{toAccount.name}</span>
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
            <div className="flex items-baseline gap-2">
              <label className="text-sm font-medium tracking-wide text-gray-500">Amount</label>
              {availableLabel && (
                <span className="text-xs text-gray-400 font-medium">{availableLabel}</span>
              )}
            </div>
            <input
              type="text"
              value={amount}
              onChange={(e) => handleNumericChange(e.target.value, setAmount)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="0.00"
            />
          </div>

          {/* Transfer Fee */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Transfer Fee</label>
            <input
              type="text"
              value={transferFee}
              onChange={(e) => handleNumericChange(e.target.value, setTransferFee)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="0.00"
            />
          </div>

          {/* Note */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Note</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="Optional transfer note"
            />
          </div>

          {/* Date and Time */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Date and Time</label>
            <input
              type="datetime-local"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
            />
          </div>

          {/* Treat as Expense Checkbox */}
          <div 
            onClick={() => setTreatAsExpense(!treatAsExpense)}
            className="col-span-1 md:col-span-2 flex items-center gap-3 p-3.5 bg-gray-50/70 rounded-2xl border border-gray-100 mt-1 cursor-pointer select-none hover:bg-gray-100/40 active:scale-[0.99] transition-all"
          >
            <input
              type="checkbox"
              checked={treatAsExpense}
              onChange={(e) => setTreatAsExpense(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-600"
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900 leading-tight">Treat as Expense</span>
              <span className="text-[11px] text-gray-500 mt-0.5 leading-snug">Count this transfer as a monthly expense (e.g. paying credit card bill) in dashboard reporting.</span>
            </div>
          </div>
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
            disabled={!fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId}
            className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <div className="flex items-center justify-center shrink-0">
              <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <span>Save transfer</span>
          </button>
        </div>
      </div>

      {/* From Account Selection Drawer - Slides in on the left side */}
      {isFromSelectorOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/15 backdrop-blur-[2px] transition-all duration-300 animate-fadeIn"
          onClick={() => {
            setIsFromSelectorOpen(false);
            setFromSearch("");
          }}
        >
          <div 
            className="fixed top-0 left-0 h-full w-full max-w-[430px] bg-white/95 backdrop-blur-2xl border-r border-gray-100 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col p-6 gap-5 animate-slideInLeft"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold text-gray-900 leading-none">Select Source Account</h3>
                <p className="text-xs text-gray-400">Choose where to transfer money from.</p>
              </div>
              <button
                onClick={() => {
                  setIsFromSelectorOpen(false);
                  setFromSearch("");
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
                value={fromSearch}
                onChange={(e) => setFromSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              />
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
                </svg>
              </div>
              {fromSearch && (
                <button
                  onClick={() => setFromSearch("")}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List of cards */}
            <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-3.5 select-none [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
              {filteredFromAccounts.map((acc, index) => {
                const theme = getBankTheme(acc.bank, acc.name, index);
                const isSelected = fromAccountId === acc.id?.toString();
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      setFromAccountId(isSelected ? "" : (acc.id?.toString() || ""));
                      setIsFromSelectorOpen(false);
                      setFromSearch("");
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
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={theme.image}
                              alt={acc.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-sm">
                              {getInitials(acc.name)}
                            </span>
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
                                  {formatNetWorth(acc.creditLimit - Math.abs(acc.balance))}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Visual utilization bar */}
                          {acc.creditLimit !== undefined && acc.creditLimit > 0 && (
                            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div
                                className="bg-white h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, (Math.abs(acc.balance) / acc.creditLimit) * 100)}%` }}
                              />
                            </div>
                          )}
                        </>
                      ) : acc.type === "Paylater" ? (
                        <>
                          <div className="flex justify-between items-end">
                            <div>
                              <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                                Remaining Balance
                              </div>
                              <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(-Math.abs(acc.balance))}</div>
                            </div>
                            {acc.installmentTermMonths && acc.balance > 0 && (
                              <div className="text-right">
                                <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                                  Monthly ({acc.installmentTermMonths}mo)
                                </div>
                                <div className={`text-sm font-bold truncate transition-all duration-300 ${isHidden ? "blur-sm select-none pointer-events-none" : ""}`}>
                                  ₱{(Math.abs(acc.balance) / acc.installmentTermMonths).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                          </div>
                          {acc.installmentTermMonths && (
                            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div className="bg-white/60 h-full rounded-full" style={{ width: "100%" }} />
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
              {filteredFromAccounts.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-400 font-medium italic">
                  No accounts match &quot;{fromSearch}&quot;.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* To Account Selection Drawer - Slides in on the right side */}
      {isToSelectorOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/15 backdrop-blur-[2px] transition-all duration-300 animate-fadeIn"
          onClick={() => {
            setIsToSelectorOpen(false);
            setToSearch("");
          }}
        >
          <div 
            className="fixed top-0 right-0 h-full w-full max-w-[430px] bg-white/95 backdrop-blur-2xl border-l border-gray-100 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col p-6 gap-5 animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold text-gray-900 leading-none">Select Destination Account</h3>
                <p className="text-xs text-gray-400">Choose where to transfer money to.</p>
              </div>
              <button
                onClick={() => {
                  setIsToSelectorOpen(false);
                  setToSearch("");
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
                value={toSearch}
                onChange={(e) => setToSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              />
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.603 10.602Z" />
                </svg>
              </div>
              {toSearch && (
                <button
                  onClick={() => setToSearch("")}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* List of cards */}
            <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-3.5 select-none [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
              {filteredToAccounts.map((acc, index) => {
                const theme = getBankTheme(acc.bank, acc.name, index);
                const isSelected = toAccountId === acc.id?.toString();
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      setToAccountId(isSelected ? "" : (acc.id?.toString() || ""));
                      setIsToSelectorOpen(false);
                      setToSearch("");
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
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={theme.image}
                              alt={acc.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-bold text-sm">
                              {getInitials(acc.name)}
                            </span>
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
                                  {formatNetWorth(acc.creditLimit - Math.abs(acc.balance))}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Visual utilization bar */}
                          {acc.creditLimit !== undefined && acc.creditLimit > 0 && (
                            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div
                                className="bg-white h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, (Math.abs(acc.balance) / acc.creditLimit) * 100)}%` }}
                              />
                            </div>
                          )}
                        </>
                      ) : acc.type === "Paylater" ? (
                        <>
                          <div className="flex justify-between items-end">
                            <div>
                              <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                                Remaining Balance
                              </div>
                              <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(-Math.abs(acc.balance))}</div>
                            </div>
                            {acc.installmentTermMonths && acc.balance > 0 && (
                              <div className="text-right">
                                <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                                  Monthly ({acc.installmentTermMonths}mo)
                                </div>
                                <div className={`text-sm font-bold truncate transition-all duration-300 ${isHidden ? "blur-sm select-none pointer-events-none" : ""}`}>
                                  ₱{(Math.abs(acc.balance) / acc.installmentTermMonths).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            )}
                          </div>
                          {acc.installmentTermMonths && (
                            <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                              <div className="bg-white/60 h-full rounded-full" style={{ width: "100%" }} />
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
              {filteredToAccounts.length === 0 && (
                <div className="text-center py-12 text-sm text-gray-400 font-medium italic">
                  No accounts match &quot;{toSearch}&quot;.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
