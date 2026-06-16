"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  ArrowDownIcon, 
  ArrowUpIcon, 
  ArrowsRightLeftIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import { db, type Transaction, type Account } from "../../lib/db";
import DeleteTransactionModal from "../DeleteTransactionModal";

export default function HistoryView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [txToDelete, setTxToDelete] = useState<{ id: number | string; description: string } | null>(null);

  // Retrieve accounts from database to know their types (Credit/Paylater)
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const accountMap = useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach(acc => {
      if (acc.id !== undefined) {
        map.set(acc.id, acc);
      }
    });
    return map;
  }, [accounts]);

  // Retrieve transactions sorted by date descending
  const transactions = useLiveQuery(async () => {
    const txs = await db.transactions.toArray();
    return txs.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.id && a.id) ? (Number(b.id) - Number(a.id)) : 0;
    });
  }) || [];

  // Expand transactions dynamically to show transfer fees as separate logs
  const expandedTransactions = useMemo(() => {
    const list: (Omit<Transaction, "id"> & { isTransferFee?: boolean; parentTx?: Transaction; id?: number | string })[] = [];
    transactions.forEach(tx => {
      list.push(tx);
      if (tx.type === "transfer" && tx.transferFee && tx.transferFee > 0) {
        list.push({
          id: `fee-${tx.id}`,
          type: "expense",
          amount: tx.transferFee,
          description: `Transfer Fee (${tx.fromAccountName} ➔ ${tx.toAccountName})`,
          category: "Transfer Fee",
          fromAccountId: tx.fromAccountId,
          fromAccountName: tx.fromAccountName,
          date: tx.date,
          fromAccountBalance: tx.fromAccountBalance,
          netWorth: tx.netWorth,
          isTransferFee: true,
          parentTx: tx
        });
      }
    });
    return list.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      // If dates match exactly, keep transfer above its fee
      if (a.isTransferFee && !b.isTransferFee) return 1;
      if (!a.isTransferFee && b.isTransferFee) return -1;
      
      // Secondary sort: latest ID on top
      const aId = typeof a.id === "string" && a.id.startsWith("fee-") ? parseInt(a.id.replace("fee-", ""), 10) : Number(a.id || 0);
      const bId = typeof b.id === "string" && b.id.startsWith("fee-") ? parseInt(b.id.replace("fee-", ""), 10) : Number(b.id || 0);
      return bId - aId;
    });
  }, [transactions]);

  // Retrieve categories from database
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Get categories list for dropdown including Transfer Fee if active
  const dropdownCategories = useMemo(() => {
    const list = categories.map(c => c.name);
    const hasTransferFee = transactions.some(tx => tx.type === "transfer" && tx.transferFee && tx.transferFee > 0);
    if (hasTransferFee && !list.includes("Transfer Fee")) {
      list.push("Transfer Fee");
    }
    return list;
  }, [categories, transactions]);

  const formatDate = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatAmount = (amount: number, type: string, treatAsExpense?: boolean) => {
    const formatted = amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (type === "income") return `+₱${formatted}`;
    if (type === "expense" || treatAsExpense) return `-₱${formatted}`;
    return `₱${formatted}`; // Transfer
  };

  const getBeforeBalance = (
    accountId: number | undefined,
    afterBalance: number,
    amount: number,
    isSender: boolean,
    fee = 0
  ) => {
    const acc = accountId !== undefined ? accountMap.get(accountId) : undefined;
    const isCredit = acc ? (acc.type === "Credit" || acc.type === "Paylater") : false;
    if (isSender) {
      return isCredit ? afterBalance - amount - fee : afterBalance + amount + fee;
    } else {
      return isCredit ? afterBalance + amount : afterBalance - amount;
    }
  };

  const formatBalanceTransition = (
    accountName: string,
    accountId: number | undefined,
    afterBalance: number | undefined,
    amount: number,
    isSender: boolean,
    fee = 0
  ) => {
    if (afterBalance === undefined) return accountName;
    const before = getBeforeBalance(accountId, afterBalance, amount, isSender, fee);
    const fmtBefore = before.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtAfter = afterBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${accountName} (₱${fmtBefore} ➔ ₱${fmtAfter})`;
  };

  const handleDelete = async (id: number | string) => {
    try {
      let targetId = id;
      if (typeof id === "string" && id.startsWith("fee-")) {
        targetId = parseInt(id.replace("fee-", ""), 10);
      }
      const tx = await db.transactions.get(targetId as number);
      if (!tx) return;

      // Reverse transaction effect on balances in a database transaction block
      await db.transaction("rw", [db.accounts, db.transactions], async () => {
        if (tx.type === "transfer" && tx.fromAccountId && tx.toAccountId) {
          const fromAcc = await db.accounts.get(tx.fromAccountId);
          const toAcc = await db.accounts.get(tx.toAccountId);
          const fee = tx.transferFee || 0;
          if (fromAcc) {
            await db.accounts.update(tx.fromAccountId, {
              balance: fromAcc.type === "Credit"
                ? fromAcc.balance - tx.amount - fee
                : fromAcc.balance + tx.amount + fee
            });
          }
          if (toAcc) {
            await db.accounts.update(tx.toAccountId, {
              balance: toAcc.type === "Credit"
                ? toAcc.balance + tx.amount
                : toAcc.balance - tx.amount
            });
          }
        } else if (tx.type === "expense" && tx.fromAccountId) {
          const fromAcc = await db.accounts.get(tx.fromAccountId);
          if (fromAcc) {
            await db.accounts.update(tx.fromAccountId, {
              balance: fromAcc.type === "Credit"
                ? fromAcc.balance - tx.amount
                : fromAcc.balance + tx.amount
            });
          }
        } else if (tx.type === "income" && tx.toAccountId) {
          const toAcc = await db.accounts.get(tx.toAccountId);
          if (toAcc) {
            await db.accounts.update(tx.toAccountId, {
              balance: toAcc.type === "Credit"
                ? toAcc.balance + tx.amount
                : toAcc.balance - tx.amount
            });
          }
        }

        // Delete transaction record
        await db.transactions.delete(id);
      });
    } catch (err) {
      console.error("Error reversing transaction:", err);
    }
  };

  // Filter transactions based on search term, type, and category
  const filteredTxs = useMemo(() => {
    return expandedTransactions.filter(tx => {
      // 1. Search term match (notes/description, category, or account names)
      const matchSearch = searchTerm.trim() === "" ||
        tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.category && tx.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.fromAccountName && tx.fromAccountName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tx.toAccountName && tx.toAccountName.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Type filter match
      let matchType = true;
      if (typeFilter === "expense") {
        matchType = tx.type === "expense" || (tx.type === "transfer" && !!tx.treatAsExpense);
      } else if (typeFilter === "income") {
        matchType = tx.type === "income";
      } else if (typeFilter === "transfer") {
        matchType = tx.type === "transfer";
      }

      // 3. Category filter match
      const matchCategory = categoryFilter === "all" || tx.category === categoryFilter;

      return matchSearch && matchType && matchCategory;
    });
  }, [expandedTransactions, searchTerm, typeFilter, categoryFilter]);



  // Dynamic totals calculated from the filtered list
  const totalIncome = useMemo(() => {
    return filteredTxs
      .filter(tx => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTxs]);

  const totalExpense = useMemo(() => {
    return filteredTxs
      .filter(tx => tx.type === "expense" || (tx.type === "transfer" && !!tx.treatAsExpense))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTxs]);

  // Group by date
  const uniqueDates = useMemo(() => {
    const dates: string[] = [];
    filteredTxs.forEach(tx => {
      const dateStr = formatDate(tx.date);
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    });
    return dates;
  }, [filteredTxs]);

  const groupedTxs = useMemo(() => {
    const groups: Record<string, typeof filteredTxs> = {};
    filteredTxs.forEach(tx => {
      const dateStr = formatDate(tx.date);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(tx);
    });
    return groups;
  }, [filteredTxs]);

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-1">History</h1>
          <p className="text-gray-500 text-sm leading-relaxed mt-1">
            View and manage all your past transactions.
          </p>
        </div>
      </div>

      {transactions.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] min-h-[420px]">
          <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No transactions logged yet</h2>
          <p className="text-gray-400 text-base max-w-sm mb-8 leading-relaxed">
            Transactions will show up here automatically when you use the Floating Action Button in the bottom corner to Move Funds, record Income or Expense.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open_fab_menu"))}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <PlusIcon className="w-6 h-6 text-white" strokeWidth={2} />
            <span>Log first transaction</span>
          </button>
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search notes, categories, or accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50/50 border border-gray-100/80 rounded-2xl pl-10 pr-4 py-3 text-[14px] font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:bg-white shadow-sm transition-all"
              />
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <MagnifyingGlassIcon className="w-5 h-5" strokeWidth={2.2} />
              </div>
            </div>

            {/* Type Filter Pills & Category Dropdown */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type Pills */}
              <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 gap-1">
                {(["all", "expense", "income", "transfer"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all cursor-pointer select-none ${
                      typeFilter === type
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-gray-100 rounded-xl px-4 pr-10 py-3 text-sm font-medium text-gray-950 appearance-none cursor-pointer focus:outline-none focus:border-purple-500/50 shadow-sm min-w-[150px]"
                >
                  <option value="all">All categories</option>
                  {dropdownCategories.map(catName => (
                    <option key={catName} value={catName}>{catName}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              
              {/* Item Count Badge */}
              <span className="bg-gray-100 px-3 py-2 rounded-2xl text-[11px] font-bold text-gray-500 shadow-sm shrink-0 select-none">
                {filteredTxs.length} {filteredTxs.length === 1 ? "ITEM" : "ITEMS"}
              </span>
            </div>
          </div>

          {/* Totals Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Income */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Income</span>
              <span className="text-2xl font-black text-emerald-600 mt-2">
                +PHP {totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Expenses */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Expenses</span>
              <span className="text-2xl font-black text-gray-800 mt-2">
                -PHP {totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Grouped Day-by-Day Transactions List */}
          {filteredTxs.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center text-gray-400 font-medium shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)]">
              No transactions match your search criteria.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {uniqueDates.map(dateStr => (
                <div key={dateStr} className="flex flex-col gap-3">
                  {/* Date Header */}
                  <div className="text-xs text-gray-400 uppercase tracking-wider pl-1">
                    {dateStr}
                  </div>

                  {/* Transactions in Date Group */}
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-gray-100/70">
                    {groupedTxs[dateStr].map(tx => {
                      const isExp = tx.type === "expense" || (tx.type === "transfer" && tx.treatAsExpense);
                      const isInc = tx.type === "income";

                      return (
                        <div
                          key={tx.id}
                          className="p-5 flex justify-between items-center hover:bg-gray-50/45 transition-colors group"
                        >
                          {/* Left side: Icon & Info */}
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Icon depending on type */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                              isInc ? "bg-green-50 text-green-600 border border-green-100/30" :
                              isExp ? "bg-red-50 text-red-600 border border-red-100/30" :
                              "bg-indigo-50 text-indigo-600 border border-indigo-100/30"
                            }`}>
                              {isInc && <ArrowDownIcon className="w-5 h-5 stroke-[2.5]" />}
                              {isExp && <ArrowUpIcon className="w-5 h-5 stroke-[2.5]" />}
                              {!isInc && !isExp && <ArrowsRightLeftIcon className="w-5 h-5 stroke-[2.5]" />}
                            </div>

                            {/* Title, Category badge, subtitle */}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-800 text-[15px] leading-tight truncate">
                                  {tx.description}
                                </span>
                                {tx.category && (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider select-none shrink-0 ${
                                    tx.category === "Credit Payment"
                                      ? "bg-purple-100 text-purple-700 border border-purple-200/50"
                                      : tx.category === "Transfer Fee"
                                        ? "bg-amber-100 text-amber-700 border border-amber-200/50"
                                        : "bg-gray-100 text-gray-600 border border-gray-200/50"
                                  }`}>
                                    {tx.category}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 mt-1.5 flex flex-wrap items-center gap-1.5 uppercase tracking-wide">
                                {tx.type === "transfer" ? (
                                  <span>
                                    {formatBalanceTransition(tx.fromAccountName || "", tx.fromAccountId, tx.fromAccountBalance, tx.amount, true, tx.transferFee || 0)}
                                    {" ➔ "}
                                    {formatBalanceTransition(tx.toAccountName || "", tx.toAccountId, tx.toAccountBalance, tx.amount, false, 0)}
                                  </span>
                                ) : tx.type === "income" ? (
                                  <span>
                                    {formatBalanceTransition(tx.toAccountName || "", tx.toAccountId, tx.toAccountBalance, tx.amount, false, 0)}
                                  </span>
                                ) : (
                                  <span>
                                    {formatBalanceTransition(tx.fromAccountName || "", tx.fromAccountId, tx.fromAccountBalance, tx.amount, true, 0)}
                                  </span>
                                )}
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-400 lowercase">{formatTime(tx.date)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right side: Amount & Delete Button */}
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5 select-none">
                                {tx.isTransferFee ? "Fee" : isInc ? "Income" : isExp ? "Expense" : "Transfer"}
                              </span>
                              <span className={`font-extrabold text-[15px] ${
                                isInc ? "text-green-600" :
                                isExp ? "text-red-500" :
                                "text-gray-600"
                              }`}>
                                {formatAmount(tx.amount, tx.type, tx.treatAsExpense)}
                              </span>
                            </div>

                            {/* Delete action */}
                            <button
                              onClick={() => {
                                setTxToDelete({ id: tx.id!, description: tx.description });
                                setIsDeleteOpen(true);
                              }}
                              className="p-2 text-gray-300 hover:text-red-500 rounded-xl hover:bg-red-50 cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150"
                              title="Delete & Reverse transaction balance"
                            >
                              <TrashIcon className="w-4.5 h-4.5" strokeWidth={2.2} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Delete Transaction Confirmation Modal */}
      <DeleteTransactionModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setTxToDelete(null);
        }}
        onConfirm={async () => {
          if (txToDelete) {
            await handleDelete(txToDelete.id);
          }
        }}
        description={txToDelete?.description || ""}
      />
    </div>
  );
}
