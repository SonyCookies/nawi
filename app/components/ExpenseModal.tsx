"use client";
 
import { useState, useEffect } from "react";
import { XMarkIcon, CheckIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { getBankTheme, getInitials } from "./views/WalletView";
 
interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}
 
export default function ExpenseModal({ isOpen, onClose }: ExpenseModalProps) {
  const [fromAccountId, setFromAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
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
 
  const categories = useLiveQuery(async () => {
    const list = await db.categories.toArray();
    return list.filter((c) => !c.type || c.type === "expense");
  }) || [];

  useEffect(() => {
    if (!category && categories.length > 0) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

  const accounts = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }) || [];

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
    const fromId = parseInt(fromAccountId);

    if (!fromId || isNaN(numAmount) || numAmount <= 0) return;

    try {
      const fromAcc = await db.accounts.get(fromId);
      if (!fromAcc) return;

      if (fromAcc.type === "Credit") {
        const remaining = (fromAcc.creditLimit ?? 0) - fromAcc.balance;
        if (numAmount > remaining) {
          window.dispatchEvent(new CustomEvent("show_toast", { 
            detail: { 
              title: "Over Credit Limit", 
              description: `Cannot complete transaction. Expense exceeds remaining credit limit.`, 
              type: "error" 
            } 
          }));
          return;
        }
      } else if (fromAcc.balance - numAmount < 0) {
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
        const updatedFromBalance = fromAcc.type === "Credit"
          ? fromAcc.balance + numAmount
          : fromAcc.balance - numAmount;

        // Source account: update balance
        await db.accounts.update(fromId, {
          balance: updatedFromBalance
        });

        const allAccs = await db.accounts.toArray();
        const currentNetWorth = allAccs
          .filter((acc) => acc.includeInTotals)
          .reduce((sum, acc) => sum + (acc.type === "Credit" ? -Math.abs(acc.balance) : acc.balance), 0);

        // Save transaction
        await db.transactions.add({
          type: "expense",
          amount: numAmount,
          description: description.trim() || category,
          category,
          fromAccountId: fromId,
          fromAccountName: fromAcc.name,
          date: new Date(datetime),
          netWorth: currentNetWorth,
          fromAccountBalance: updatedFromBalance
        });
      });

      onClose();
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Expense Logged", 
          description: `₱${amount} from ${fromAcc.name}`, 
          type: "success" 
        } 
      }));
      // Reset
      setFromAccountId("");
      setAmount("");
      setCategory("Bills");
      setDescription("");
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      setDatetime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    } catch (err) {
      console.error("Error logging expense:", err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Error", 
          description: "Failed to record expense.", 
          type: "error" 
        } 
      }));
    }
  };

  // Get selected account's currency for the helper label
  const selectedAccount = accounts.find(a => a.id?.toString() === fromAccountId);
  const selectedAccountTheme = selectedAccount 
    ? getBankTheme(selectedAccount.bank, selectedAccount.name, accounts.indexOf(selectedAccount))
    : null;

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
    acc.type.toLowerCase().includes(accountSearch.toLowerCase()) ||
    (acc.bank && acc.bank.toLowerCase().includes(accountSearch.toLowerCase()))
  );

  const currencyLabel = selectedAccount?.currency || "PHP";

  const isCredit = selectedAccount?.type === "Credit";
  const creditLimitRemaining = selectedAccount && isCredit
    ? Math.max(0, (selectedAccount.creditLimit ?? 0) - selectedAccount.balance)
    : 0;

  const helperLabel = selectedAccount
    ? isCredit
      ? `Limit Remaining: ${selectedAccount.currency === "PHP" ? "₱" : selectedAccount.currency}${creditLimitRemaining.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `Available: ${selectedAccount.currency === "PHP" ? "₱" : selectedAccount.currency}${selectedAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `Saved in ${currencyLabel}.`;

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
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Add expense</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Log spending into the imported session and refresh the dashboard right away.
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

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <label className="text-sm font-medium tracking-wide text-gray-500">Amount</label>
              <span className="text-xs text-gray-400 font-medium">{helperLabel}</span>
            </div>
            <input
              type="text"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="0.00"
            />
          </div>

          {/* Account Selector Button */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Account</label>
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

          {/* Category */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium tracking-wide text-gray-500">Category</label>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("navigate_tab", { detail: "Settings" }));
                  onClose();
                }}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Customize categories in Settings"
              >
                <PencilSquareIcon className="w-3.5 h-3.5" />
                <span>Customize</span>
              </button>
            </div>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
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

          {/* Note - Full Width */}
          <div className="flex flex-col gap-2 col-span-full">
            <label className="text-sm font-medium tracking-wide text-gray-500">Note</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
              placeholder="What was this for?"
            />
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
            disabled={!fromAccountId || !amount}
            className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-[#c0634f] to-[#d4816e] text-white font-semibold text-lg rounded-xl shadow-md shadow-[#c0634f]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <div className="flex items-center justify-center shrink-0">
              <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <span>Save expense</span>
          </button>
        </div>
      </div>

      {/* Account Selection Drawer */}
      {isAccountSelectorOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/15 backdrop-blur-[2px] transition-all duration-300 animate-fadeIn"
          onClick={() => {
            setIsAccountSelectorOpen(false);
            setAccountSearch("");
          }}
        >
          <div 
            className="fixed top-0 right-0 h-full w-full max-w-[430px] bg-white/95 backdrop-blur-2xl border-l border-gray-100 shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col p-6 gap-5 animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold text-gray-900 leading-none">Select Account</h3>
                <p className="text-xs text-gray-400">Choose source account for expense.</p>
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
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
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

            {/* List of cards */}
            <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-3.5 select-none [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
              {filteredAccounts.map((acc, index) => {
                const theme = getBankTheme(acc.bank, acc.name, index);
                const isSelected = fromAccountId === acc.id?.toString();
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      setFromAccountId(isSelected ? "" : (acc.id?.toString() || ""));
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
    </div>
  );
}
