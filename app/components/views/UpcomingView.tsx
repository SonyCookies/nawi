"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ScheduledItem, type Account } from "../../lib/db";
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowPathIcon, 
  BanknotesIcon, 
  CheckIcon 
} from "@heroicons/react/24/outline";
import AddScheduledExpenseModal from "../AddScheduledExpenseModal";
import AddScheduledIncomeModal from "../AddScheduledIncomeModal";
import PaylaterDetailModal from "../PaylaterDetailModal";
import PaylaterPaymentModal from "../PaylaterPaymentModal";
import RecordScheduledPaymentModal from "../RecordScheduledPaymentModal";
import { SUPPORTED_BANKS } from "../AddAccountModal";

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

function nextCreditDueDate(dueDay: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const candidate = new Date(year, month, dueDay);
  if (candidate <= now) {
    // Due day has passed this month → next month
    return new Date(year, month + 1, dueDay);
  }
  return candidate;
}

function getBankImage(bankId: string | undefined) {
  const b = SUPPORTED_BANKS.find((b) => b.id === bankId);
  return b ? b.image : null;
}

// ── sub-components ────────────────────────────────────────────────────────────

interface DaysBadgeProps { days: number; }
function DaysBadge({ days }: DaysBadgeProps) {
  if (days < 0) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200/60 tracking-wide font-medium">
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200/60 tracking-wide font-medium">
        Due today
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200/60 tracking-wide font-medium">
        In {days}d
      </span>
    );
  }
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200/60 tracking-wide font-medium">
      In {days}d
    </span>
  );
}

interface SectionCardProps {
  title: string;
  count: number;
  children: React.ReactNode;
  accent: "purple" | "red" | "emerald";
  onAdd?: () => void;
}
function SectionCard({ title, count, children, accent, onAdd }: SectionCardProps) {
  const accentMap = {
    purple: { badge: "bg-purple-50 text-purple-700 border-purple-100/30", addBtn: "hover:bg-purple-50 hover:text-purple-600" },
    red: { badge: "bg-red-50 text-red-700 border-red-100/30", addBtn: "hover:bg-red-50 hover:text-red-600" },
    emerald: { badge: "bg-emerald-50 text-emerald-700 border-emerald-100/30", addBtn: "hover:bg-emerald-50 hover:text-emerald-600" },
  };
  const a = accentMap[accent];

  return (
    <div className="flex-1 min-w-0 bg-white border border-gray-100 rounded-[24px] p-5 flex flex-col gap-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">{title}</span>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${a.badge}`}>
            {count}
          </span>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm ${
              accent === "red"
                ? "bg-red-50 text-red-600 border-red-100/30 hover:bg-red-100/50 hover:border-red-200/50"
                : "bg-emerald-50 text-emerald-600 border-emerald-100/30 hover:bg-emerald-100/50 hover:border-emerald-200/50"
            }`}
            title="Add item"
          >
            <PlusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>Add</span>
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

// ── scheduled item icon ────────────────────────────────────────────────────────
interface ScheduledItemIconProps {
  description: string;
  type: "expense" | "income";
  categoryIcon?: string;
}
function ScheduledItemIcon({ description, type, categoryIcon }: ScheduledItemIconProps) {
  const desc = description.toLowerCase();
  const isSpotify = desc.includes("spotify");

  if (isSpotify) {
    return (
      <div className="w-9 h-9 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/subscription-apps/spotify.webp" alt="Spotify" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (categoryIcon) {
    return (
      <div className="w-9 h-9 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 text-xl">
        {categoryIcon}
      </div>
    );
  }

  if (type === "expense") {
    return (
      <div className="w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
        <ArrowPathIcon className="w-4.5 h-4.5 text-red-500" strokeWidth={2} />
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
      <BanknotesIcon className="w-4.5 h-4.5 text-emerald-600" strokeWidth={2} />
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-xs text-gray-300 italic py-2">{label}</p>
  );
}

// ── main view ─────────────────────────────────────────────────────────────────

export default function UpcomingView() {
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const [selectedPaylaterAccount, setSelectedPaylaterAccount] = useState<Account | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  const [selectedScheduledItem, setSelectedScheduledItem] = useState<ScheduledItem | null>(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<ScheduledItem | null>(null);

  const openDetailModal = (acc: Account) => {
    setSelectedPaylaterAccount(acc);
    setShowDetailModal(true);
  };

  const openPayModal = (acc: Account) => {
    setSelectedPaylaterAccount(acc);
    setShowPayModal(true);
  };

  const openEditScheduledItem = (item: ScheduledItem) => {
    setItemToEdit(item);
    if (item.type === "expense") {
      setShowAddExpenseModal(true);
    } else {
      setShowAddIncomeModal(true);
    }
  };

  const openRecordPaymentModal = (item: ScheduledItem) => {
    setSelectedScheduledItem(item);
    setShowRecordPaymentModal(true);
  };

  const accounts = useLiveQuery(() => db.accounts.toArray(), [refresh]);
  const scheduledItems = useLiveQuery(() => db.scheduledItems.toArray(), [refresh]);
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const categoryIconMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => {
      if (c.icon) map[c.name.toLowerCase()] = c.icon;
    });
    return map;
  }, [categories]);

  const creditAccounts = (accounts ?? []).filter(
    (a) => a.type === "Credit" && a.includeInTotals !== false
  );

  const paylaterAccounts = (accounts ?? []).filter(
    (a) => a.type === "Paylater" && a.includeInTotals !== false
  );

  const recurringExpenses = (scheduledItems ?? []).filter((i) => i.type === "expense" && i.isActive !== false);
  const recurringIncome = (scheduledItems ?? []).filter((i) => i.type === "income" && i.isActive !== false);

  const handleDelete = async (id: number) => {
    await db.scheduledItems.delete(id);
    setRefresh((r) => r + 1);
  };

  // Calculate upcoming outflow vs inflow summaries
  const summaries = useMemo(() => {
    let totalOutflow = 0;
    let totalInflow = 0;

    // Credit dues (account balance is negative or represents utilized limit)
    creditAccounts.forEach(acc => {
      totalOutflow += Math.abs(acc.balance);
    });

    // Paylater installments due
    paylaterAccounts.forEach(acc => {
      const term = acc.installmentTermMonths || 3;
      const monthly = acc.customInstallmentPayments && acc.customInstallmentPayments.length > 0
        ? acc.customInstallmentPayments[0]
        : (acc.balance > 0 ? acc.balance / term : 0);
      totalOutflow += monthly;
    });

    // Recurring expenses
    recurringExpenses.forEach(item => {
      totalOutflow += item.amount;
    });

    // Recurring incomes
    recurringIncome.forEach(item => {
      totalInflow += item.amount;
    });

    return { totalOutflow, totalInflow };
  }, [creditAccounts, paylaterAccounts, recurringExpenses, recurringIncome]);

  return (
    <>
      <div className="flex flex-col gap-6 animate-fadeIn select-none">
        {/* Header */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-purple-600 uppercase tracking-widest leading-none font-medium">Plan</span>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mt-1 mb-1">Upcoming</h1>
          <p className="text-gray-500 text-sm leading-relaxed mt-1">
            See upcoming dues and recurring items that need attention next.
          </p>
        </div>

        {/* Premium Upcoming Cashflow Summary Card */}
        <div className="w-full bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-[28px] p-6 shadow-xl shadow-purple-950/15 mb-2 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          {/* Glowing background highlights */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />

          {/* Left Side: Summary Metrics */}
          <div className="flex flex-col gap-1.5 z-10 w-full md:w-[45%]">
            <span className="text-xs uppercase tracking-wider text-purple-300 font-medium">Plan Summary</span>
            <h2 className="text-3xl font-black tracking-tight mt-1">Upcoming Cashflow</h2>
            
            <div className="flex justify-between items-baseline mt-4 border-b border-white/10 pb-3">
              <span className="text-sm text-purple-200 font-medium">Total Outflows due:</span>
              <span className="text-xl font-bold">{formatCurrency(summaries.totalOutflow)}</span>
            </div>

            <div className="flex justify-between items-baseline mt-2">
              <span className="text-sm text-purple-200 font-medium">Total Inflows expected:</span>
              <span className="text-xl font-bold text-emerald-400">
                {formatCurrency(summaries.totalInflow)}
              </span>
            </div>
          </div>

          {/* Right Side: Net Balance Card */}
          <div className="w-full md:w-[50%] flex flex-col gap-3 z-10 bg-white/5 border border-white/10 p-5 rounded-2xl">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-purple-300 uppercase font-medium">Net Planner Balance</span>
                <div className={`text-2xl font-black tracking-tight mt-1 ${
                  summaries.totalInflow >= summaries.totalOutflow ? "text-emerald-400" : "text-amber-400"
                }`}>
                  {formatCurrency(summaries.totalInflow - summaries.totalOutflow)}
                </div>
              </div>
              <div>
                {summaries.totalInflow >= summaries.totalOutflow ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                    Cash Surplus
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                    Outflow Deficit
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-purple-200/70 leading-relaxed mt-1">
              Summarizes upcoming credit card dues, active Paylater cycles, scheduled recurring expenses, and expected recurring incomes.
            </p>
          </div>
        </div>

        {/* Four-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">

          {/* ── Credit Dues ─────────────────────────────────────────────────── */}
          <SectionCard
            title="Credit dues"
            count={creditAccounts.length}
            accent="purple"
          >
            {creditAccounts.length === 0 ? (
              <EmptyState label="No credit accounts found." />
            ) : (
              creditAccounts.map((acc) => {
                const dueDate = acc.paymentDueDay
                  ? nextCreditDueDate(acc.paymentDueDay)
                  : null;
                const days = dueDate ? daysFromNow(dueDate) : null;
                const bankImg = getBankImage(acc.bank);

                return (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-purple-500/20 hover:shadow transition-all duration-200"
                  >
                    {/* Bank logo */}
                    <div className="w-9 h-9 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                      {bankImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bankImg} alt={acc.bank} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">
                          {acc.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{acc.name}</div>
                      <div className="text-xs text-gray-400">
                        {acc.type} • {acc.currency}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {days !== null && <DaysBadge days={days} />}
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(acc.balance, acc.currency)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </SectionCard>

          {/* ── Paylater Dues ───────────────────────────────────────────────── */}
          <SectionCard
            title="Paylaters"
            count={paylaterAccounts.length}
            accent="purple"
          >
            {paylaterAccounts.length === 0 ? (
              <EmptyState label="No paylater accounts found." />
            ) : (
              paylaterAccounts.map((acc) => {
                const dueDate = acc.paymentDueDay
                  ? nextCreditDueDate(acc.paymentDueDay)
                  : null;
                const days = dueDate ? daysFromNow(dueDate) : null;
                const bankImg = getBankImage(acc.bank);
                const term = acc.installmentTermMonths || 3;
                const calculatedMonthly = acc.customInstallmentPayments && acc.customInstallmentPayments.length > 0
                  ? acc.customInstallmentPayments[0]
                  : (acc.balance > 0 ? acc.balance / term : 0);

                return (
                  <div
                    key={acc.id}
                    className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-purple-500/20 hover:shadow transition-all duration-200 group relative overflow-hidden"
                  >
                    {/* Bank logo */}
                    <div className="w-9 h-9 rounded-full bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                      {bankImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={bankImg} alt={acc.bank} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-gray-400">
                          {acc.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-8 group-hover:pr-16 transition-all duration-200">
                      <div className="text-sm font-bold text-gray-900 truncate">{acc.name}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {term}mo term • {formatCurrency(acc.balance, acc.currency)} left
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 group-hover:opacity-0 transition-opacity duration-200">
                      {days !== null && <DaysBadge days={days} />}
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(calculatedMonthly, acc.currency)}/mo
                      </span>
                    </div>

                    {/* Actions overlay */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-all duration-200">
                      <button
                        onClick={() => openDetailModal(acc)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 text-gray-400 hover:text-purple-600 shadow-sm transition-colors cursor-pointer"
                        title="Installment details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openPayModal(acc)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm transition-colors cursor-pointer"
                        title="Pay installment"
                      >
                        <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </SectionCard>

          {/* ── Recurring Expenses ───────────────────────────────────────────── */}
          <SectionCard
            title="Recurring expenses"
            count={recurringExpenses.length}
            accent="red"
            onAdd={() => setShowAddExpenseModal(true)}
          >
            {recurringExpenses.length === 0 ? (
              <EmptyState label="Nothing queued here yet." />
            ) : (
              recurringExpenses.map((item) => {
                const days = item.nextDueDate ? daysFromNow(new Date(item.nextDueDate)) : null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-red-500/20 hover:shadow transition-all duration-200 group relative overflow-hidden"
                  >
                    <ScheduledItemIcon 
                      description={item.description} 
                      type={item.type} 
                      categoryIcon={categoryIconMap[(item.category || "").toLowerCase()]} 
                    />
                    <div className="flex-1 min-w-0 pr-8 group-hover:pr-24 transition-all duration-200">
                      <div className="text-sm font-bold text-gray-900 truncate">{item.description}</div>
                      <div className="text-xs text-gray-400 capitalize truncate">
                        {item.interval} • {item.category || "Other"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 group-hover:opacity-0 transition-opacity duration-200">
                      {days !== null && <DaysBadge days={days} />}
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>

                    {/* Actions overlay */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200">
                      <button
                        onClick={() => item.id && handleDelete(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 hover:border-red-200 text-gray-400 hover:text-red-500 shadow-sm transition-colors cursor-pointer"
                        title="Delete scheduled item"
                      >
                        <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => openEditScheduledItem(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 text-gray-400 hover:text-purple-600 shadow-sm transition-colors cursor-pointer"
                        title="Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openRecordPaymentModal(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500 text-white hover:bg-red-600 shadow-sm transition-colors cursor-pointer"
                        title="Pay item"
                      >
                        <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </SectionCard>

          {/* ── Recurring Income ─────────────────────────────────────────────── */}
          <SectionCard
            title="Recurring income"
            count={recurringIncome.length}
            accent="emerald"
            onAdd={() => setShowAddIncomeModal(true)}
          >
            {recurringIncome.length === 0 ? (
              <EmptyState label="Nothing queued here yet." />
            ) : (
              recurringIncome.map((item) => {
                const days = item.nextDueDate ? daysFromNow(new Date(item.nextDueDate)) : null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-emerald-500/20 hover:shadow transition-all duration-200 group relative overflow-hidden"
                  >
                    <ScheduledItemIcon 
                      description={item.description} 
                      type={item.type} 
                      categoryIcon={categoryIconMap[(item.category || "").toLowerCase()]} 
                    />
                    <div className="flex-1 min-w-0 pr-8 group-hover:pr-24 transition-all duration-200">
                      <div className="text-sm font-bold text-gray-900 truncate">{item.description}</div>
                      <div className="text-xs text-gray-400 capitalize truncate">
                        {item.interval} • {item.category || "Other"}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 group-hover:opacity-0 transition-opacity duration-200">
                      {days !== null && <DaysBadge days={days} />}
                      <span className="text-sm font-bold text-emerald-600">
                        +{formatCurrency(item.amount)}
                      </span>
                    </div>

                    {/* Actions overlay */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all duration-200">
                      <button
                        onClick={() => item.id && handleDelete(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 hover:border-red-200 text-gray-400 hover:text-red-500 shadow-sm transition-colors cursor-pointer"
                        title="Delete scheduled item"
                      >
                        <TrashIcon className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => openEditScheduledItem(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 text-gray-400 hover:text-purple-600 shadow-sm transition-colors cursor-pointer"
                        title="Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openRecordPaymentModal(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors cursor-pointer"
                        title="Receive income"
                      >
                        <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </SectionCard>
        </div>
      </div>

      {/* Add scheduled expense modal */}
      <AddScheduledExpenseModal
        isOpen={showAddExpenseModal}
        onClose={() => {
          setShowAddExpenseModal(false);
          setItemToEdit(null);
        }}
        itemToEdit={itemToEdit}
        onSaved={() => setRefresh((r) => r + 1)}
      />

      {/* Add scheduled income modal */}
      <AddScheduledIncomeModal
        isOpen={showAddIncomeModal}
        onClose={() => {
          setShowAddIncomeModal(false);
          setItemToEdit(null);
        }}
        itemToEdit={itemToEdit}
        onSaved={() => setRefresh((r) => r + 1)}
      />

      {/* Paylater Detail modal */}
      <PaylaterDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        account={selectedPaylaterAccount}
        onSaved={() => setRefresh((r) => r + 1)}
      />

      {/* Paylater Payment modal */}
      <PaylaterPaymentModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        account={selectedPaylaterAccount}
        onSaved={() => setRefresh((r) => r + 1)}
      />

      {/* Record Scheduled Payment/Income modal */}
      <RecordScheduledPaymentModal
        isOpen={showRecordPaymentModal}
        onClose={() => {
          setShowRecordPaymentModal(false);
          setSelectedScheduledItem(null);
        }}
        item={selectedScheduledItem}
        onSaved={() => setRefresh((r) => r + 1)}
      />
    </>
  );
}
