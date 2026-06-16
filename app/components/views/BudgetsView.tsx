"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  PlusIcon,
  PencilIcon, 
  TrashIcon
} from "@heroicons/react/24/outline";
import { db, type Category } from "../../lib/db";
import AddBudgetModal from "../AddBudgetModal";
import EditBudgetModal from "../EditBudgetModal";
import DeleteBudgetModal from "../DeleteBudgetModal";

// Helper function to calculate date boundaries for a given period type
export function getPeriodBoundaries(period: "daily" | "weekly" | "biweekly" | "monthly" | "yearly", referenceDate: Date = new Date()) {
  const start = new Date(referenceDate);
  const end = new Date(referenceDate);

  switch (period) {
    case "daily":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "weekly": {
      const day = referenceDate.getDay();
      start.setDate(referenceDate.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "biweekly": {
      // Bi-weekly starting reference: Sunday, Jan 4, 2026
      const reference = new Date(2026, 0, 4);
      const diffMs = referenceDate.getTime() - reference.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const cycleIndex = Math.floor(diffDays / 14);
      const startOfCycle = new Date(reference);
      startOfCycle.setDate(reference.getDate() + cycleIndex * 14);
      startOfCycle.setHours(0, 0, 0, 0);
      
      start.setTime(startOfCycle.getTime());
      end.setTime(startOfCycle.getTime());
      end.setDate(start.getDate() + 13);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "monthly":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case "yearly":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }
  return { start, end };
}

export default function BudgetsView() {
  const [selectedPeriodTab, setSelectedPeriodTab] = useState<"All" | "Daily" | "Weekly" | "Bi-weekly" | "Monthly" | "Yearly">("All");
  
  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Drag & drop sorting states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [displayCategories, setDisplayCategories] = useState<Category[]>([]);

  // Retrieve categories and transactions from Dexie
  const categories = useLiveQuery(async () => {
    const list = await db.categories.toArray();
    const expenseOnly = list.filter(c => !c.type || c.type === "expense");
    return expenseOnly.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }) || [];

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

  // Get categories that have a budget limit configured
  const budgetedCategories = useMemo(() => {
    return categories.filter(c => c.budget !== undefined && c.budget > 0);
  }, [categories]);

  // Filter categories according to the selected period tab
  const filteredCategories = useMemo(() => {
    return budgetedCategories.filter(cat => {
      if (selectedPeriodTab === "All") return true;
      const internalPeriod = cat.budgetPeriod || "monthly";
      if (selectedPeriodTab === "Daily") return internalPeriod === "daily";
      if (selectedPeriodTab === "Weekly") return internalPeriod === "weekly";
      if (selectedPeriodTab === "Bi-weekly") return internalPeriod === "biweekly";
      if (selectedPeriodTab === "Monthly") return internalPeriod === "monthly";
      if (selectedPeriodTab === "Yearly") return internalPeriod === "yearly";
      return true;
    });
  }, [budgetedCategories, selectedPeriodTab]);

  // Sync displayCategories with filteredCategories when not dragging
  useEffect(() => {
    if (draggedIndex === null) {
      setDisplayCategories(filteredCategories);
    }
  }, [filteredCategories, draggedIndex]);

  // Calculate actual spending per budgeted category based on its period boundaries
  const categorySpending = useMemo(() => {
    const spendingMap: Record<string, number> = {};

    budgetedCategories.forEach(cat => {
      const period = cat.budgetPeriod || "monthly";
      const { start, end } = getPeriodBoundaries(period);

      let sum = 0;
      transactions.forEach(tx => {
        const txTime = new Date(tx.date).getTime();
        if (txTime >= start.getTime() && txTime <= end.getTime()) {
          if (tx.type === "expense" && (tx.category || "Other") === cat.name) {
            sum += tx.amount;
          } else if (tx.type === "transfer") {
            if (tx.treatAsExpense && (tx.category || "Other") === cat.name) {
              sum += tx.amount;
            }
            if (cat.name === "Transfer Fee" && tx.transferFee && tx.transferFee > 0) {
              sum += tx.transferFee;
            }
          }
        }
      });
      spendingMap[cat.name] = sum;
    });

    return spendingMap;
  }, [transactions, budgetedCategories]);

  // Totals calculations across the filtered budgeted categories
  const totals = useMemo(() => {
    let totalBudget = 0;
    let totalSpentOnBudgets = 0;

    filteredCategories.forEach(cat => {
      const spent = categorySpending[cat.name] || 0;
      if (cat.budget !== undefined && cat.budget > 0) {
        totalBudget += cat.budget;
        totalSpentOnBudgets += spent;
      }
    });

    return { totalBudget, totalSpentOnBudgets };
  }, [filteredCategories, categorySpending]);

  // Drag & drop sorting handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...displayCategories];
    const [item] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, item);

    setDraggedIndex(index);
    setDisplayCategories(reordered);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    // Persist final order mapping displayCategories back to global list
    const allCategories = [...categories];
    const originalGlobalIndices = filteredCategories.map(fc => allCategories.findIndex(c => c.id === fc.id));

    originalGlobalIndices.forEach((globalIdx, i) => {
      if (globalIdx !== -1 && displayCategories[i]) {
        allCategories[globalIdx] = displayCategories[i];
      }
    });

    try {
      await db.transaction("rw", db.categories, async () => {
        for (let i = 0; i < allCategories.length; i++) {
          if (allCategories[i].id) {
            await db.categories.update(allCategories[i].id!, { sortOrder: i });
          }
        }
      });
    } catch (err) {
      console.error("Failed to update category sort orders:", err);
    }

    setDraggedIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const formatCurrency = (val: number) => {
    return `₱${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <>
      <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] text-purple-600 uppercase tracking-widest leading-none font-medium">
            Plan
          </span>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mt-1 mb-1">Budgets</h1>
          <p className="text-gray-500 text-sm leading-relaxed mt-1">
            Set custom spending limits for each category to track your allowances and targets.
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer animate-fadeIn"
        >
          <div className="flex items-center justify-center shrink-0">
            <PlusIcon className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <span>Add budget</span>
        </button>
      </div>

      {/* Period Selector & Summary Container */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 flex-wrap gap-1 w-max">
          {(["All", "Daily", "Weekly", "Bi-weekly", "Monthly", "Yearly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriodTab(p)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${selectedPeriodTab === p
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                : "text-gray-500 hover:text-gray-800"
                }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Total Budget Progress Card */}
      <div className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-[28px] p-6 shadow-xl shadow-purple-950/15 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
        {/* Glowing background highlights */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />

        {/* Left Side: Summary Metrics */}
        <div className="flex flex-col gap-1.5 z-10 w-full md:w-[45%]">
          <span className="text-xs uppercase tracking-wider text-purple-300 font-medium">
            {selectedPeriodTab === "All" ? "Overall Summary" : `${selectedPeriodTab} Summary`}
          </span>
          <h2 className="text-3xl font-black tracking-tight mt-1">Budget Overview</h2>
          
          <div className="flex justify-between items-baseline mt-4 border-b border-white/10 pb-3">
            <span className="text-sm text-purple-200 font-medium">Total Spent:</span>
            <span className="text-xl font-bold">{formatCurrency(totals.totalSpentOnBudgets)}</span>
          </div>

          <div className="flex justify-between items-baseline mt-2">
            <span className="text-sm text-purple-200 font-medium">Total Limits:</span>
            <span className="text-xl font-bold text-purple-300">
              {totals.totalBudget > 0 ? formatCurrency(totals.totalBudget) : "No limits set"}
            </span>
          </div>
        </div>

        {/* Right Side: Progress Bar & Status */}
        {totals.totalBudget > 0 ? (
          <div className="w-full md:w-[50%] flex flex-col gap-3 z-10">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-xs text-purple-300 uppercase font-medium">Budget Utilized</span>
                <div className="text-2xl font-black tracking-tight mt-0.5">
                  {((totals.totalSpentOnBudgets / totals.totalBudget) * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-purple-300 uppercase font-medium">Status</span>
                <div className="mt-0.5">
                  {totals.totalSpentOnBudgets > totals.totalBudget ? (
                    <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider">
                      Over Budget
                    </span>
                  ) : (
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider">
                      On Track
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Premium Progress Bar */}
            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/55 shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  totals.totalSpentOnBudgets > totals.totalBudget 
                    ? "bg-gradient-to-r from-red-500 to-rose-500 animate-pulse" 
                    : totals.totalSpentOnBudgets > totals.totalBudget * 0.8 
                      ? "bg-gradient-to-r from-amber-400 to-orange-500" 
                      : "bg-gradient-to-r from-emerald-400 to-teal-500"
                }`}
                style={{ width: `${Math.min(100, (totals.totalSpentOnBudgets / totals.totalBudget) * 100)}%` }}
              />
            </div>
            
            <div className="text-xs text-purple-200 mt-1 flex justify-between font-medium">
              <span>₱0.00</span>
              <span>
                {totals.totalSpentOnBudgets > totals.totalBudget 
                  ? `${formatCurrency(totals.totalSpentOnBudgets - totals.totalBudget)} over limit`
                  : `${formatCurrency(totals.totalBudget - totals.totalSpentOnBudgets)} remaining`
                }
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full md:w-[50%] bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-3 z-10">
            <span className="text-sm font-semibold text-purple-300">Set budget limits to see progress</span>
            <p className="text-xs text-purple-200/70 max-w-xs leading-relaxed">
              Click &quot;Add budget&quot; above to define spending limits and track your outlays reactively.
            </p>
          </div>
        )}
      </div>

      {/* Categories Budget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {displayCategories.map((cat, index) => {
          const spent = categorySpending[cat.name] || 0;
          const limit = cat.budget;
          const hasLimit = limit !== undefined && limit > 0;
          const progress = hasLimit ? (spent / limit!) * 100 : 0;
          
          const rawPeriod = cat.budgetPeriod || "monthly";
          const formattedPeriod = rawPeriod === "biweekly" ? "bi-weekly" : rawPeriod;
          const capitalizedPeriod = formattedPeriod.charAt(0).toUpperCase() + formattedPeriod.slice(1);

          // Color tags depending on utilization
          let barColor = "bg-gradient-to-r from-emerald-400 to-teal-500";
          let textColor = "text-emerald-600";
          let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100/30";
          
          if (hasLimit) {
            if (progress > 100) {
              barColor = "bg-gradient-to-r from-red-500 to-rose-500 animate-pulse";
              textColor = "text-red-500";
              badgeBg = "bg-red-50 text-red-700 border-red-100/30";
            } else if (progress > 80) {
              barColor = "bg-gradient-to-r from-amber-400 to-orange-500";
              textColor = "text-amber-600";
              badgeBg = "bg-amber-50 text-amber-700 border-amber-100/30";
            }
          }

          return (
            <div 
              key={cat.name} 
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              className={`relative overflow-hidden p-6 rounded-2xl bg-white border border-gray-100 shadow-md flex flex-col justify-between h-44 transition-all duration-200 cursor-grab active:cursor-grabbing group hover:border-purple-500/20 hover:shadow-lg ${
                draggedIndex === index ? "opacity-30 scale-95" : ""
              }`}
            >
              {/* Category Info header */}
              <div className="flex items-start justify-between">
                <div className="overflow-hidden pr-2">
                  <div className="text-base font-bold text-gray-900 truncate" title={cat.name}>
                    {cat.name}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate mt-0.5">
                    {capitalizedPeriod} Budget
                  </div>
                </div>

                {/* Edit / Delete overlay buttons (opacity-0 on load, visible on hover) */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0 bg-white pl-2">
                  <button
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsEditOpen(true);
                    }}
                    className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors p-1 rounded cursor-pointer"
                    title="Edit budget"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsDeleteOpen(true);
                    }}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors p-1 rounded cursor-pointer"
                    title="Delete budget"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>

                {/* Status indicator shown when not hovering */}
                <div className="group-hover:hidden transition-all duration-150 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badgeBg}`}>
                    {progress > 100 ? "Over Limit" : progress > 80 ? "Near Limit" : "On Track"}
                  </span>
                </div>
              </div>

              {/* Progress and values */}
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
                      Spent
                    </div>
                    <div className="text-2xl font-black text-gray-900 truncate">
                      {formatCurrency(spent)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
                      Limit
                    </div>
                    <div className="text-md font-bold text-gray-800 truncate">
                      {formatCurrency(limit!)}
                    </div>
                  </div>
                </div>

                {/* Visual spent progress bar */}
                <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>

                {/* Leftover / Over limit subtext */}
                <div className={`text-[12px] font-bold ${textColor} mt-0.5`}>
                  {spent > limit! 
                    ? `${formatCurrency(spent - limit!)} Over Limit`
                    : `${formatCurrency(limit! - spent)} Remaining`
                  }
                </div>
              </div>
            </div>
          );
        })}

        {displayCategories.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-gray-100 text-gray-400 font-medium">
            No budgets configured in this section. Click &quot;Add budget&quot; to create one.
          </div>
        )}
      </div>
      </div>

      {/* Add Budget Modal */}
      <AddBudgetModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
      />

      {/* Edit Budget Modal */}
      {selectedCategory && (
        <EditBudgetModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setSelectedCategory(null);
          }}
          category={selectedCategory}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedCategory && (
        <DeleteBudgetModal
          isOpen={isDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false);
            setSelectedCategory(null);
          }}
          onConfirm={async () => {
            await db.categories.update(selectedCategory.id!, {
              budget: undefined,
              budgetPeriod: undefined
            });
            window.dispatchEvent(new CustomEvent("show_toast", { 
              detail: { 
                title: "Budget Deleted", 
                description: `Budget limit for ${selectedCategory.name} was removed.`, 
                type: "success" 
              } 
            }));
          }}
          categoryName={selectedCategory.name}
        />
      )}
    </>
  );
}
