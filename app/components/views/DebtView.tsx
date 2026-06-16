"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { db, type Debt } from "../../lib/db";
import AddDebtModal from "../AddDebtModal";
import RecordDebtPaymentModal from "../RecordDebtPaymentModal";
import IncreaseDebtModal from "../IncreaseDebtModal";
import DebtDetailModal from "../DebtDetailModal";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "PHP") {
  const sym = currency === "PHP" ? "₱" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  return `${sym}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysFromNow(date: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ── sub-components ────────────────────────────────────────────────────────────

interface DaysBadgeProps { days: number; }
function DaysBadge({ days }: DaysBadgeProps) {
  if (days < 0) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 tracking-wide font-semibold">
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 tracking-wide font-semibold">
        Due today
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100 tracking-wide font-semibold">
      In {days}d
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="col-span-full py-16 flex flex-col items-center justify-center text-center gap-3">
      <span className="text-sm font-semibold text-gray-400">{label}</span>
    </div>
  );
}

/* ─── Delete confirmation modal ───────────────────────────────────────────── */
function DeleteDebtModal({
  debt,
  onClose,
  onConfirm,
}: {
  debt: Debt | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!debt) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      <div
        className="w-full max-w-[480px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[24px] p-5 relative flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
        </button>

        <div className="flex gap-4 items-start pr-8">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6" strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xl font-bold text-gray-955 leading-tight">Delete debt</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{debt.personName}&quot;</span>? This will permanently remove it from your records.
            </p>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-red-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Main View ───────────────────────────────────────────────────────────── */
export default function DebtView() {
  const [selectedTab, setSelectedTab] = useState<"Outstanding" | "Paid / Settled">("Outstanding");
  const [addOpen, setAddOpen] = useState(false);
  const [recordDebt, setRecordDebt] = useState<Debt | null>(null);
  const [increaseDebt, setIncreaseDebt] = useState<Debt | null>(null);
  const [deleteDebt, setDeleteDebt] = useState<Debt | null>(null);
  const [selectedDetailDebt, setSelectedDetailDebt] = useState<Debt | null>(null);
  const [refresh, setRefresh] = useState(0);

  const debts = useLiveQuery(async () => {
    const list = await db.debts.toArray();
    return list.filter(d => d.type === "borrow").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [refresh]) || [];

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [displayDebts, setDisplayDebts] = useState<Debt[]>([]);

  // Sync selected details debt after refresh
  useEffect(() => {
    if (selectedDetailDebt) {
      const updated = debts.find(d => d.id === selectedDetailDebt.id);
      if (updated) {
        setSelectedDetailDebt(updated);
      }
    }
  }, [debts, selectedDetailDebt]);

  // Statistics
  const stats = useMemo(() => {
    let totalOwed = 0;
    let totalSettled = 0;
    let totalAmount = 0;
    debts.forEach((d) => {
      totalAmount += d.amount;
      totalSettled += d.paidAmount;
      if (d.status !== "paid") {
        totalOwed += (d.amount - d.paidAmount);
      }
    });
    return { totalOwed, totalSettled, totalAmount };
  }, [debts]);

  // Filter list depending on selected tab
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (selectedTab === "Outstanding") return d.status !== "paid";
      return d.status === "paid";
    });
  }, [debts, selectedTab]);

  useEffect(() => {
    if (draggedIndex === null) {
      setDisplayDebts(filteredDebts);
    }
  }, [filteredDebts, draggedIndex]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...displayDebts];
    const [item] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, item);

    setDraggedIndex(index);
    setDisplayDebts(reordered);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    const allDebts = await db.debts.toArray();
    const originalGlobalIndices = filteredDebts.map(fd => allDebts.findIndex(d => d.id === fd.id));

    originalGlobalIndices.forEach((globalIdx, i) => {
      if (globalIdx !== -1 && displayDebts[i]) {
        allDebts[globalIdx] = displayDebts[i];
      }
    });

    try {
      await db.transaction("rw", db.debts, async () => {
        for (let i = 0; i < allDebts.length; i++) {
          if (allDebts[i].id) {
            await db.debts.update(allDebts[i].id!, { sortOrder: i });
          }
        }
      });
    } catch (err) {
      console.error("Failed to update debt sort orders:", err);
    }

    setDraggedIndex(null);
    setRefresh(r => r + 1);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDelete = async (id: number) => {
    const debtObj = await db.debts.get(id);
    if (!debtObj) return;

    try {
      await db.transaction("rw", [db.debts, db.accounts, db.transactions], async () => {
        if (debtObj.history) {
          for (const log of debtObj.history) {
            if (log.accountId) {
              const account = await db.accounts.get(log.accountId);
              if (account) {
                let balanceAdjustment = 0;
                if (debtObj.type === "borrow") {
                  if (log.type === "creation" || log.type === "increase") {
                    balanceAdjustment = -log.amount;
                  } else if (log.type === "payment") {
                    balanceAdjustment = log.amount;
                  }
                } else {
                  if (log.type === "creation" || log.type === "increase") {
                    balanceAdjustment = -log.amount;
                  } else if (log.type === "payment") {
                    balanceAdjustment = -log.amount;
                  }
                }

                if (balanceAdjustment !== 0) {
                  await db.accounts.update(log.accountId, {
                    balance: account.balance + balanceAdjustment
                  });
                }
              }
            }

            const logTime = new Date(log.date).getTime();
            const dateMin = new Date(logTime - 60000);
            const dateMax = new Date(logTime + 60000);
            
            const txs = await db.transactions
              .where("date")
              .between(dateMin, dateMax, true, true)
              .toArray();

            const matchingTx = txs.find(tx => {
              const matchesAmt = Math.abs(tx.amount - log.amount) < 0.01;
              const matchesAcc = tx.toAccountId === log.accountId || tx.fromAccountId === log.accountId;
              const matchesType = (log.type === "payment" && debtObj.type === "borrow" && tx.type === "expense") ||
                                 (log.type === "payment" && debtObj.type !== "borrow" && tx.type === "income") ||
                                 ((log.type === "creation" || log.type === "increase") && debtObj.type === "borrow" && tx.type === "income");
              return matchesAmt && matchesAcc && matchesType;
            });

            if (matchingTx && matchingTx.id) {
              await db.transactions.delete(matchingTx.id);
            }
          }
        }

        await db.debts.delete(id);
      });

      setRefresh((r) => r + 1);
      if (selectedDetailDebt && selectedDetailDebt.id === id) {
        setSelectedDetailDebt(null);
      }
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Debt Removed",
          description: "The item, its transaction logs, and account balances have been reversed and deleted.",
          type: "success"
        }
      }));
    } catch (err) {
      console.error("Error deleting debt:", err);
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Error",
          description: "Failed to reverse transactions and delete debt.",
          type: "error"
        }
      }));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 animate-fadeIn select-none">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] text-purple-600 uppercase tracking-widest leading-none font-medium">Plan</span>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mt-1 mb-1">Owed to Someone</h1>
            <p className="text-gray-500 text-sm leading-relaxed mt-1">
              Track amounts you owe to other people, repayments, and settlement statuses.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer animate-fadeIn shrink-0"
          >
            <div className="flex items-center justify-center shrink-0">
              <PlusIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <span>Add debt</span>
          </button>
        </div>

        {/* Premium Cashflow Summary Card */}
        <div className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-[28px] p-6 shadow-xl shadow-purple-950/15 mb-2 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          {/* Glowing background highlights */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />

          {/* Left Side: Summary Metrics */}
          <div className="flex flex-col gap-1.5 z-10 w-full md:w-[45%]">
            <span className="text-xs uppercase tracking-wider text-purple-300 font-medium">Debt Summary</span>
            <h2 className="text-3xl font-black tracking-tight mt-1">Repayments Cashflow</h2>
            
            <div className="flex justify-between items-baseline mt-4 border-b border-white/10 pb-3">
              <span className="text-sm text-purple-200 font-medium">Total Outstanding:</span>
              <span className="text-xl font-bold">{formatCurrency(stats.totalOwed)}</span>
            </div>

            <div className="flex justify-between items-baseline mt-2">
              <span className="text-sm text-purple-200 font-medium">Total Settled:</span>
              <span className="text-xl font-bold text-emerald-400">
                {formatCurrency(stats.totalSettled)}
              </span>
            </div>
          </div>

          {/* Right Side: Net Balance Card */}
          <div className="w-full md:w-[50%] flex flex-col gap-3 z-10 bg-white/5 border border-white/10 p-5 rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-purple-300 uppercase font-medium">Repayment Progress</span>
                <div className="text-2xl font-black tracking-tight mt-1 text-emerald-400">
                  {stats.totalAmount > 0 ? Math.round((stats.totalSettled / stats.totalAmount) * 100) : 0}%
                </div>
              </div>
            </div>
            <p className="text-xs text-purple-200/70 leading-relaxed mt-1">
              Shows how much you have successfully paid back out of the total ₱{stats.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} initially borrowed.
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 flex-wrap gap-1 w-max mb-2">
          {(["Outstanding", "Paid / Settled"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                selectedTab === tab
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab === "Outstanding" ? `Outstanding (${stats.totalOwed > 0 ? formatCurrency(stats.totalOwed) : "₱0.00"})` : tab}
            </button>
          ))}
        </div>

        {/* Categories Budget-style Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
          {displayDebts.length === 0 ? (
            <EmptyState label={selectedTab === "Outstanding" ? "All paid up! No outstanding debts." : "Nothing paid back yet."} />
          ) : (
            displayDebts.map((debt, index) => {
              const remaining = debt.amount - debt.paidAmount;
              const progress = debt.amount > 0 ? (debt.paidAmount / debt.amount) * 100 : 0;
              const days = debt.dueDate ? daysFromNow(new Date(debt.dueDate)) : null;

              return (
                <div
                  key={debt.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                  onClick={() => setSelectedDetailDebt(debt)}
                  className={`relative overflow-hidden p-6 rounded-2xl bg-white border border-gray-100 shadow-md flex flex-col justify-between h-44 transition-all duration-200 group hover:border-purple-500/20 hover:shadow-lg cursor-grab active:cursor-grabbing ${
                    draggedIndex === index ? "opacity-30 scale-95" : ""
                  }`}
                >
                  {/* Category Info Header */}
                  <div className="flex items-start justify-between">
                    <div className="overflow-hidden pr-2 group-hover:pr-16 transition-all duration-200">
                      <div className="text-base font-bold text-gray-900 truncate" title={debt.personName}>
                        {debt.personName}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate mt-0.5">
                        {debt.description || "No description"}
                      </div>
                    </div>

                    {/* Edit / Delete overlays */}
                    <div 
                      className="absolute right-6 top-6 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setDeleteDebt(debt)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 hover:border-red-200 text-gray-400 hover:text-red-500 shadow-sm transition-colors cursor-pointer"
                        title="Delete debt"
                      >
                        <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      {debt.status !== "paid" && (
                        <button
                          onClick={() => setRecordDebt(debt)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition-colors cursor-pointer"
                          title="Record payment / Settle"
                        >
                          <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </button>
                      )}
                    </div>

                    {/* Status/Overdue Indicator */}
                    <div className="group-hover:opacity-0 transition-opacity duration-200 shrink-0">
                      {days !== null && debt.status !== "paid" ? (
                        <DaysBadge days={days} />
                      ) : (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                          debt.status === "paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100/30"
                            : debt.status === "partially-paid"
                              ? "bg-sky-50 text-sky-700 border-sky-100/30"
                              : "bg-amber-50 text-amber-700 border-amber-100/30"
                        }`}>
                          {debt.status === "paid" ? "Settled" : debt.status === "partially-paid" ? "Partial" : "Open"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress and values */}
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
                          {selectedTab === "Outstanding" ? "Paid" : "Settled Amount"}
                        </div>
                        <div className="text-2xl font-black text-gray-900 truncate">
                          {formatCurrency(debt.paidAmount)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
                          {selectedTab === "Outstanding" ? "Remaining" : "Total Debt"}
                        </div>
                        <div className="text-sm font-bold text-gray-800 truncate">
                          {formatCurrency(selectedTab === "Outstanding" ? remaining : debt.amount)}
                        </div>
                      </div>
                    </div>

                    {/* Visual spent progress bar */}
                    {debt.status !== "paid" && (
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-300"
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      <AddDebtModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => setRefresh((r) => r + 1)}
      />
      <RecordDebtPaymentModal
        debt={recordDebt}
        isOpen={!!recordDebt}
        onClose={() => setRecordDebt(null)}
        onRecorded={() => setRefresh((r) => r + 1)}
      />
      <IncreaseDebtModal
        debt={increaseDebt}
        isOpen={!!increaseDebt}
        onClose={() => setIncreaseDebt(null)}
        onUpdated={() => setRefresh((r) => r + 1)}
      />
      <DebtDetailModal
        debt={selectedDetailDebt}
        isOpen={!!selectedDetailDebt}
        onClose={() => setSelectedDetailDebt(null)}
        onIncreaseClick={() => setIncreaseDebt(selectedDetailDebt)}
        onRecordClick={() => setRecordDebt(selectedDetailDebt)}
      />
      <DeleteDebtModal
        debt={deleteDebt}
        onClose={() => setDeleteDebt(null)}
        onConfirm={() => deleteDebt?.id && handleDelete(deleteDebt.id)}
      />
    </>
  );
}
