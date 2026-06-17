"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { 
  ArrowPathIcon, 
  WalletIcon,
  CalendarDaysIcon,
  BellAlertIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  ChartPieIcon
} from "@heroicons/react/24/outline";
import { getPeriodBoundaries } from "./BudgetsView";

// Bank logos mapping matching WalletView
const BANK_LOGOS: Record<string, string> = {
  bdo: "/banks/bdo.png",
  bpi: "/banks/bpi.png",
  gcash: "/banks/gcash.jpg",
  gotyme: "/banks/gotyme.png",
  landbank: "/banks/landbank.jpg",
  maribank: "/banks/maribank.png",
  maya: "/banks/maya.jpg",
  metrobank: "/banks/metrobank.jpg",
  pnb: "/banks/pnb.png",
  securitybank: "/banks/securitybank.png",
  unionbank: "/banks/unionbank.jpg",
  tiktok: "/banks/tiktok.avif",
  shopee: "/banks/shopee.png",
  wise: "/banks/wise.png",
  cash: "/banks/wallet.webp",
};

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
    return new Date(year, month + 1, dueDay);
  }
  return candidate;
}

function DaysBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-bold shrink-0">
        {Math.abs(days)}d overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 font-bold shrink-0">
        Due today
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-150/60 font-bold shrink-0">
      In {days}d
    </span>
  );
}

export default function HomeView() {
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_balances") === "true";
    }
    return false;
  });

  const [googleName, setGoogleName] = useState<string | null>(null);
  const [hoveredDot, setHoveredDot] = useState<{ idx: number; type: "income" | "expense" | "both" } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const savedProfile = sessionStorage.getItem("gdrive_user_profile");
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        const name = profile.given_name || profile.name || profile.email.split("@")[0];
        setGoogleName(name);
      } catch (err) {
        console.error(err);
      }
    }

    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsHidden(customEvent.detail);
    };
    window.addEventListener("balance_visibility_changed", handleEvent);
    return () => {
      window.removeEventListener("balance_visibility_changed", handleEvent);
    };
  }, []);

  // Retrieve accounts, transactions, scheduled items, categories
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const scheduledItems = useLiveQuery(() => db.scheduledItems.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Group accounts (limit total displayed accounts to 5)
  const everydayAccounts = useMemo(() => {
    const debitList = accounts.filter(a => a.type === "Debit" || a.type === "Savings" || a.type === "Cash");
    return debitList.slice(0, 3);
  }, [accounts]);

  const creditAccounts = useMemo(() => {
    const creditList = accounts.filter(a => a.type === "Credit" || a.type === "Paylater");
    return creditList.slice(0, 5 - everydayAccounts.length);
  }, [accounts, everydayAccounts]);

  // Current month calculations
  const now = useMemo(() => new Date(), []);
  const startOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);
  const endOfMonth = useMemo(() => new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999), [now]);

  const monthlyIncome = useMemo(() => {
    const filtered = transactions.filter((tx) => {
      const txTime = new Date(tx.date).getTime();
      return tx.type === "income" && txTime >= startOfMonth.getTime() && txTime <= endOfMonth.getTime();
    });
    return filtered.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, startOfMonth, endOfMonth]);

  const monthlyExpense = useMemo(() => {
    return transactions.reduce((sum, tx) => {
      const txTime = new Date(tx.date).getTime();
      if (txTime >= startOfMonth.getTime() && txTime <= endOfMonth.getTime()) {
        if (tx.type === "expense") {
          return sum + tx.amount;
        }
        if (tx.type === "transfer") {
          let amt = 0;
          if (tx.treatAsExpense) {
            amt += tx.amount;
          }
          if (tx.transferFee && tx.transferFee > 0) {
            amt += tx.transferFee;
          }
          return sum + amt;
        }
      }
      return sum;
    }, 0);
  }, [transactions, startOfMonth, endOfMonth]);

  const formattedDate = useMemo(() => {
    return now.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  }, [now]);

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  // Sort and limit last 5 transactions (incorporating transfer fees matching HistoryView)
  const lastTransactions = useMemo(() => {
    const list: any[] = [];
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
    return list
      .sort((a, b) => {
        const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.isTransferFee && !b.isTransferFee) return 1;
        if (!a.isTransferFee && b.isTransferFee) return -1;
        return 0;
      })
      .slice(0, 5);
  }, [transactions]);

  // Combined upcoming snippet selection (limit 4 items)
  const upcomingItems = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      type: string;
      amount: number;
      dueDate: Date;
      daysRemaining: number;
      bank?: string;
      category?: string;
      isIncome: boolean;
    }> = [];

    // 1. Credit dues
    accounts.forEach(acc => {
      if (acc.type === "Credit" && acc.paymentDueDay) {
        const dueDate = nextCreditDueDate(acc.paymentDueDay);
        const days = daysFromNow(dueDate);
        items.push({
          id: `credit-${acc.id}`,
          name: acc.name,
          type: "Credit Card",
          amount: Math.abs(acc.balance),
          dueDate,
          daysRemaining: days,
          bank: acc.bank,
          isIncome: false
        });
      }
    });

    // 2. Paylater installment dues
    accounts.forEach(acc => {
      if (acc.type === "Paylater" && acc.paymentDueDay) {
        const dueDate = nextCreditDueDate(acc.paymentDueDay);
        const days = daysFromNow(dueDate);
        const term = acc.installmentTermMonths || 3;
        const monthly = acc.customInstallmentPayments && acc.customInstallmentPayments.length > 0
          ? acc.customInstallmentPayments[0]
          : (acc.balance > 0 ? acc.balance / term : 0);
        
        items.push({
          id: `paylater-${acc.id}`,
          name: acc.name,
          type: "Paylater Cycle",
          amount: monthly,
          dueDate,
          daysRemaining: days,
          bank: acc.bank,
          isIncome: false
        });
      }
    });

    // 3. Scheduled Items (recurring bills/incomes)
    scheduledItems.forEach(item => {
      if (item.isActive && item.nextDueDate) {
        const dueDate = new Date(item.nextDueDate);
        const days = daysFromNow(dueDate);
        items.push({
          id: `scheduled-${item.id}`,
          name: item.description,
          type: item.type === "expense" ? "Scheduled Expense" : "Scheduled Income",
          amount: item.amount,
          dueDate,
          daysRemaining: days,
          category: item.category,
          isIncome: item.type === "income"
        });
      }
    });

    return items
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 4);
  }, [accounts, scheduledItems]);

  // Budget watchlist calculation (limit top 4 most utilized budgets)
  const budgetWatchlist = useMemo(() => {
    const budgeted = categories.filter(c => c.budget !== undefined && c.budget > 0);
    const list = budgeted.map(cat => {
      const limit = cat.budget || 0;
      const period = cat.budgetPeriod || "monthly";
      const { start, end } = getPeriodBoundaries(period);

      let spent = 0;
      transactions.forEach(tx => {
        const txTime = new Date(tx.date).getTime();
        if (txTime >= start.getTime() && txTime <= end.getTime()) {
          if (tx.type === "expense" && (tx.category || "Other") === cat.name) {
            spent += tx.amount;
          } else if (tx.type === "transfer") {
            if (tx.treatAsExpense && (tx.category || "Other") === cat.name) {
              spent += tx.amount;
            }
            if (cat.name === "Transfer Fee" && tx.transferFee && tx.transferFee > 0) {
              spent += tx.transferFee;
            }
          }
        }
      });

      const progress = limit > 0 ? (spent / limit) * 100 : 0;
      return {
        id: cat.id,
        name: cat.name,
        limit,
        spent,
        progress,
        period,
        icon: cat.icon
      };
    });

    return list
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4);
  }, [categories, transactions]);

  // Formatter helpers
  const formatCurrency = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `₱${formatted}`;
  };

  const getAccountLogo = (bankId: string | undefined, name: string) => {
    const bank = (bankId || "").toLowerCase();
    const accName = (name || "").toLowerCase();

    // 1. Explicit matching via bankId
    if (bank && bank !== "other" && BANK_LOGOS[bank]) {
      return BANK_LOGOS[bank];
    }

    // 2. Fuzzy name matching
    for (const key of Object.keys(BANK_LOGOS)) {
      if (accName.includes(key)) {
        return BANK_LOGOS[key];
      }
    }

    // 3. Description fallback matches
    if (accName.includes("cash") || accName.includes("hand")) {
      return "/banks/wallet.webp";
    }

    return null;
  };

  const getTransactionLogo = (tx: any) => {
    const desc = (tx.description || "").toLowerCase();
    if (desc.includes("spotify")) {
      return "/subscription-apps/spotify.webp";
    }
    const accId = tx.type === "income" ? tx.toAccountId : tx.fromAccountId;
    if (!accId) {
      if (tx.fromAccountName?.toLowerCase().includes("cash") || tx.toAccountName?.toLowerCase().includes("cash")) {
        return "/banks/wallet.webp";
      }
      return null;
    }
    const acc = accounts.find(a => a.id === accId);
    return getAccountLogo(acc?.bank, acc?.name || "");
  };

  const getAccountTheme = (bankId: string | undefined, type: string) => {
    if (type === "Credit" || type === "Paylater") {
      return "bg-[#fdf2f8]/60 border-[#fce7f3]/60 text-pink-900 hover:border-pink-300 hover:bg-[#fdf2f8]/80 transition-all duration-200";
    }
    const bank = (bankId || "").toLowerCase();
    if (bank === "bpi") return "bg-[#fef2f2]/60 border-[#fee2e2]/60 text-red-900 hover:border-red-300 hover:bg-[#fef2f2]/80 transition-all duration-200";
    if (bank === "cash") return "bg-[#fefce8]/60 border-[#fef9c3]/60 text-yellow-900 hover:border-yellow-300 hover:bg-[#fefce8]/80 transition-all duration-200";
    if (bank === "gcash") return "bg-[#eff6ff]/60 border-[#dbeafe]/60 text-blue-900 hover:border-blue-300 hover:bg-[#eff6ff]/80 transition-all duration-200";
    if (bank === "bdo") return "bg-[#eff6ff]/60 border-[#dbeafe]/60 text-indigo-900 hover:border-blue-300 hover:bg-[#eff6ff]/80 transition-all duration-200";
    return "bg-gray-50/50 border border-gray-100 text-gray-900 hover:border-gray-300 transition-all duration-200";
  };

  const getCategoryTagStyles = (category: string, type: string) => {
    const cat = (category || "").toLowerCase();
    if (cat === "transfer fee") return "bg-amber-50 text-amber-700 border-amber-100/30";
    if (type === "income") return "bg-emerald-50 text-emerald-700 border-emerald-100/30";
    if (cat === "bills") return "bg-blue-50 text-blue-700 border-blue-100/30";
    if (cat === "food") return "bg-emerald-50 text-emerald-700 border-emerald-100/30";
    if (cat === "goal") return "bg-purple-50 text-purple-700 border-purple-100/30";
    if (cat === "shopping") return "bg-pink-50 text-pink-700 border-pink-100/30";
    return "bg-gray-50 text-gray-600 border-gray-200/50";
  };

  // Daily trend calculations for the last 7 days
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const fullDateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      
      const inc = transactions
        .filter((tx) => tx.type === "income" && new Date(tx.date).getTime() >= start.getTime() && new Date(tx.date).getTime() <= end.getTime())
        .reduce((sum, tx) => sum + tx.amount, 0);
        
      const exp = transactions
        .filter((tx) => {
          const txTime = new Date(tx.date).getTime();
          return (tx.type === "expense" || (tx.type === "transfer" && (tx.treatAsExpense || (tx.transferFee && tx.transferFee > 0)))) &&
            txTime >= start.getTime() && txTime <= end.getTime();
        })
        .reduce((sum, tx) => {
          let amt = 0;
          if (tx.type === "expense") {
            amt += tx.amount;
          } else if (tx.type === "transfer") {
            if (tx.treatAsExpense) {
              amt += tx.amount;
            }
            if (tx.transferFee && tx.transferFee > 0) {
              amt += tx.transferFee;
            }
          }
          return sum + amt;
        }, 0);
        
      data.push({
        label: dayLabel,
        fullDateLabel,
        income: inc,
        expense: exp,
      });
    }
    return data;
  }, [transactions, now]);

  const maxVal = useMemo(() => {
    let maxActual = 0;
    chartData.forEach((d) => {
      if (d.income > maxActual) maxActual = d.income;
      if (d.expense > maxActual) maxActual = d.expense;
    });
    if (maxActual <= 0) return 1000;
    
    // Add 20% margin to the actual max value
    const padded = maxActual * 1.2;
    
    // Determine a clean rounding boundary step size
    let step = 10;
    if (padded > 100000) {
      step = 50000;
    } else if (padded > 50000) {
      step = 10000;
    } else if (padded > 10000) {
      step = 5000;
    } else if (padded > 5000) {
      step = 1000;
    } else if (padded > 1000) {
      step = 500;
    } else if (padded > 500) {
      step = 100;
    } else if (padded > 100) {
      step = 50;
    }
    
    const rounded = Math.ceil(padded / step) * step;
    return rounded;
  }, [chartData]);

  const yAxisTicks = useMemo(() => {
    return [
      maxVal,
      maxVal * 0.75,
      maxVal * 0.5,
      maxVal * 0.25,
      0
    ];
  }, [maxVal]);

  const formatTick = (val: number) => {
    if (val === 0) return "0";
    if (val >= 1000) return `${val / 1000}K`;
    return val.toString();
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 select-none">
      {/* Title Header */}
      <div className="flex flex-col gap-0.5 mb-2">
        <span className="text-[11px] text-purple-600 uppercase tracking-widest leading-none font-medium">
          {formattedDate}
        </span>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mt-1 mb-1">
          {googleName ? `${greeting}, ${googleName}!` : `${greeting}!`}
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mt-1">
          Here is your financial status overview, recent activity, and upcoming dues for this month.
        </p>
      </div>

      {/* Monthly Trend & Outflow/Inflow Analytics (White design with purple accent at top) */}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
        
        {/* Left Column - In/Out Cards */}
        <div className="w-full lg:w-[32%] flex flex-col gap-4">
          
          {/* Out Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-[28px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:border-purple-500/20 transition-all duration-200 flex flex-col justify-between h-[175px] relative overflow-hidden group">
            <span className="absolute top-5 right-5 text-[10px] text-purple-600 font-bold uppercase bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full tracking-wider">
              OUT
            </span>
            <div className="flex flex-col gap-1.5 z-10">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider">This Month Out</span>
              <span className={`text-4xl font-black text-gray-900 leading-tight tracking-tight transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
                {formatCurrency(monthlyExpense)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 z-10">
              <ArrowUpRightIcon className="w-4 h-4 text-purple-500 shrink-0" strokeWidth={2.5} />
              <span>Logged spending in the current month</span>
            </div>
          </div>

          {/* In Card */}
          <div className="bg-white border border-gray-100 p-6 rounded-[28px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:border-purple-500/20 transition-all duration-200 flex flex-col justify-between h-[175px] relative overflow-hidden group">
            <span className="absolute top-5 right-5 text-[10px] text-emerald-600 font-bold uppercase bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full tracking-wider">
              IN
            </span>
            <div className="flex flex-col gap-1.5 z-10">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider">This Month In</span>
              <span className={`text-4xl font-black text-gray-900 leading-tight tracking-tight transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
                {formatCurrency(monthlyIncome)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 z-10">
              <ArrowDownLeftIcon className="w-4 h-4 text-emerald-550 shrink-0" strokeWidth={2.5} />
              <span>Logged income in the current month</span>
            </div>
          </div>

        </div>

        {/* Right Column - Cashflow Trend Graph (White Theme) */}
        <div className="w-full lg:w-[68%] bg-white border border-gray-100 p-6 rounded-[28px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:border-purple-500/20 transition-all duration-200 flex flex-col gap-4 relative overflow-hidden">
          <div className="flex justify-between items-start z-10">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-purple-600 uppercase tracking-wider font-semibold">Cashflow</span>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">7-day trend</h2>
            </div>
            
            {/* Legend & Currency */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3.5 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0" />
                  <span className="text-gray-500 uppercase tracking-wider text-[10px]">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shrink-0" />
                  <span className="text-gray-500 uppercase tracking-wider text-[10px]">Expenses</span>
                </div>
              </div>
              <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full tracking-wider">
                PHP
              </span>
            </div>
          </div>

          {/* Custom Pure-CSS & SVG Line Chart */}
          <div className="flex-1 min-h-[220px] flex flex-col gap-3 justify-end pt-3 z-10">
            <div className="flex-1 relative flex flex-col justify-between chart-container">
              {/* Horizontal grid lines */}
              {yAxisTicks.map((tick, idx) => (
                <div key={idx} className="w-full flex items-center gap-3 relative">
                  <span className="text-[10px] font-semibold text-gray-400 w-8 text-right shrink-0">
                    {formatTick(tick)}
                  </span>
                  <div className="flex-1 border-t border-gray-100" />
                </div>
              ))}

              {/* Follow Tooltip */}
              {hoveredDot !== null && chartData[hoveredDot.idx] && (
                <div 
                  className="absolute bg-purple-950 text-white text-[13px] px-4 py-3 rounded-2xl shadow-xl border border-purple-900/30 whitespace-nowrap z-40 gap-2 flex flex-col pointer-events-none transition-all duration-75 animate-fadeIn"
                  style={{
                    left: `${mousePos.x}px`,
                    top: `${mousePos.y - 12}px`,
                    transform: 'translate(-50%, -100%)'
                  }}
                >
                  <div className="text-[11px] text-purple-300 border-b border-purple-800/60 pb-1.5 mb-0.5 text-center uppercase tracking-wider font-bold">
                    {chartData[hoveredDot.idx].fullDateLabel}
                  </div>
                  {hoveredDot.type === "both" ? (
                    <>
                      <div className="flex justify-between gap-6 items-center">
                        <span className="text-emerald-450 font-medium">Incoming:</span>
                        <span className="text-white font-bold">{formatCurrency(chartData[hoveredDot.idx].income)}</span>
                      </div>
                      <div className="flex justify-between gap-6 items-center">
                        <span className="text-red-400 font-medium">Outgoing:</span>
                        <span className="text-white font-bold">{formatCurrency(chartData[hoveredDot.idx].expense)}</span>
                      </div>
                    </>
                  ) : hoveredDot.type === "income" ? (
                    <div className="flex justify-between gap-6 items-center">
                      <span className="text-emerald-450 font-medium">Incoming:</span>
                      <span className="text-white font-bold">{formatCurrency(chartData[hoveredDot.idx].income)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-6 items-center">
                      <span className="text-red-400 font-medium">Outgoing:</span>
                      <span className="text-white font-bold">{formatCurrency(chartData[hoveredDot.idx].expense)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* SVG Line & Area Renderings */}
              <div className="absolute inset-y-0 left-11 right-0 pointer-events-none">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Area under Income Line */}
                  <path 
                    d={(() => {
                      let d = "";
                      chartData.forEach((data, idx) => {
                        const x = ((idx * 2 + 1) / 14) * 100;
                        const y = 100 - (data.income / maxVal) * 100;
                        if (idx === 0) {
                          d = `M ${x} ${y}`;
                        } else {
                          const prevX = (((idx - 1) * 2 + 1) / 14) * 100;
                          const prevY = 100 - (chartData[idx - 1].income / maxVal) * 100;
                          const cpX1 = prevX + (x - prevX) / 3;
                          const cpY1 = prevY;
                          const cpX2 = prevX + 2 * (x - prevX) / 3;
                          const cpY2 = y;
                          d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
                        }
                      });
                      if (!d) return "";
                      const firstX = (1 / 14) * 100;
                      const lastX = (((chartData.length - 1) * 2 + 1) / 14) * 100;
                      return `${d} L ${lastX} 100 L ${firstX} 100 Z`;
                    })()} 
                    fill="url(#incomeGrad)" 
                  />

                  {/* Area under Expense Line */}
                  <path 
                    d={(() => {
                      let d = "";
                      chartData.forEach((data, idx) => {
                        const x = ((idx * 2 + 1) / 14) * 100;
                        const y = 100 - (data.expense / maxVal) * 100;
                        if (idx === 0) {
                          d = `M ${x} ${y}`;
                        } else {
                          const prevX = (((idx - 1) * 2 + 1) / 14) * 100;
                          const prevY = 100 - (chartData[idx - 1].expense / maxVal) * 100;
                          const cpX1 = prevX + (x - prevX) / 3;
                          const cpY1 = prevY;
                          const cpX2 = prevX + 2 * (x - prevX) / 3;
                          const cpY2 = y;
                          d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
                        }
                      });
                      if (!d) return "";
                      const firstX = (1 / 14) * 100;
                      const lastX = (((chartData.length - 1) * 2 + 1) / 14) * 100;
                      return `${d} L ${lastX} 100 L ${firstX} 100 Z`;
                    })()} 
                    fill="url(#expenseGrad)" 
                  />

                  {/* Income Line */}
                  <path 
                    d={(() => {
                      let d = "";
                      chartData.forEach((data, idx) => {
                        const x = ((idx * 2 + 1) / 14) * 100;
                        const y = 100 - (data.income / maxVal) * 100;
                        if (idx === 0) {
                          d = `M ${x} ${y}`;
                        } else {
                          const prevX = (((idx - 1) * 2 + 1) / 14) * 100;
                          const prevY = 100 - (chartData[idx - 1].income / maxVal) * 100;
                          const cpX1 = prevX + (x - prevX) / 3;
                          const cpY1 = prevY;
                          const cpX2 = prevX + 2 * (x - prevX) / 3;
                          const cpY2 = y;
                          d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
                        }
                      });
                      return d;
                    })()} 
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                  />

                  {/* Expense Line */}
                  <path 
                    d={(() => {
                      let d = "";
                      chartData.forEach((data, idx) => {
                        const x = ((idx * 2 + 1) / 14) * 100;
                        const y = 100 - (data.expense / maxVal) * 100;
                        if (idx === 0) {
                          d = `M ${x} ${y}`;
                        } else {
                          const prevX = (((idx - 1) * 2 + 1) / 14) * 100;
                          const prevY = 100 - (chartData[idx - 1].expense / maxVal) * 100;
                          const cpX1 = prevX + (x - prevX) / 3;
                          const cpY1 = prevY;
                          const cpX2 = prevX + 2 * (x - prevX) / 3;
                          const cpY2 = y;
                          d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x} ${y}`;
                        }
                      });
                      return d;
                    })()} 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                  />
                </svg>
              </div>

              {/* Columns containing vertical highlight lines and interactive hover areas */}
              <div className="absolute inset-y-0 left-11 right-0 flex justify-around items-stretch pb-0.5">
                {chartData.map((data, idx) => {
                  const isIncomeHovered = hoveredDot?.idx === idx && (hoveredDot?.type === "income" || hoveredDot?.type === "both");
                  const isExpenseHovered = hoveredDot?.idx === idx && (hoveredDot?.type === "expense" || hoveredDot?.type === "both");
                  const isAnyHovered = hoveredDot !== null;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center w-[64px] justify-center relative rounded-2xl transition-all duration-200 ${
                        isAnyHovered 
                          ? (isIncomeHovered || isExpenseHovered)
                            ? "bg-purple-50/10 shadow-[0_8px_30px_rgba(0,0,0,0.005)]" 
                            : "opacity-45 scale-[0.99]"
                          : ""
                      }`}
                    >
                      {/* Vertical highlight line when either dot of this day is hovered */}
                      {(isIncomeHovered || isExpenseHovered) && (
                        <div className="absolute inset-y-0 w-[1px] bg-purple-500/20 border-dashed pointer-events-none" />
                      )}

                      {/* Income Dot Hover Box (w-8 h-8 wrapper for easier hover) */}
                      <div 
                        onMouseEnter={() => setHoveredDot({ idx, type: "income" })}
                        onMouseLeave={() => setHoveredDot(null)}
                        onMouseMove={(e) => {
                          const chartEl = e.currentTarget.closest('.chart-container');
                          if (chartEl) {
                            const rect = (chartEl as HTMLElement).getBoundingClientRect();
                            setMousePos({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top
                            });
                          }
                        }}
                        className="absolute w-8 h-8 flex items-center justify-center cursor-pointer z-20"
                        style={{ bottom: `calc(${(data.income / maxVal) * 100}% - 16px)` }}
                      >
                        <div 
                          className={`w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-md transition-all duration-200 ${
                            isIncomeHovered ? "scale-135 ring-4 ring-emerald-500/25" : ""
                          }`}
                        />
                      </div>

                      {/* Expense Dot Hover Box (w-8 h-8 wrapper for easier hover) */}
                      <div 
                        onMouseEnter={() => setHoveredDot({ idx, type: "expense" })}
                        onMouseLeave={() => setHoveredDot(null)}
                        onMouseMove={(e) => {
                          const chartEl = e.currentTarget.closest('.chart-container');
                          if (chartEl) {
                            const rect = (chartEl as HTMLElement).getBoundingClientRect();
                            setMousePos({
                              x: e.clientX - rect.left,
                              y: e.clientY - rect.top
                            });
                          }
                        }}
                        className="absolute w-8 h-8 flex items-center justify-center cursor-pointer z-20"
                        style={{ bottom: `calc(${(data.expense / maxVal) * 100}% - 16px)` }}
                      >
                        <div 
                          className={`w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-md transition-all duration-200 ${
                            isExpenseHovered ? "scale-135 ring-4 ring-red-500/25" : ""
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex pl-11 justify-around text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {chartData.map((data, idx) => {
                const isLabelHovered = hoveredDot?.idx === idx;
                return (
                  <span 
                    key={idx} 
                    className={`w-[64px] text-center cursor-pointer py-1 rounded-lg transition-all duration-200 ${
                      isLabelHovered ? "text-purple-600 bg-purple-50" : "text-gray-400 hover:text-purple-600 hover:bg-gray-50/50"
                    }`}
                    onMouseEnter={() => setHoveredDot({ idx, type: "both" })}
                    onMouseLeave={() => setHoveredDot(null)}
                    onMouseMove={(e) => {
                      const chartEl = document.querySelector('.chart-container');
                      if (chartEl) {
                        const rect = (chartEl as HTMLElement).getBoundingClientRect();
                        setMousePos({
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top
                        });
                      }
                    }}
                  >
                    {data.label}
                  </span>
                );
              })}
            </div>

          </div>

        </div>

      </div>

      {/* Main Grid: 2 columns, with column-based vertical stacking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mt-2">
        
        {/* Left Column Stack */}
        <div className="flex flex-col gap-6">
          {/* Card 1: Transactions */}
          <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">Transactions</span>
              <span className="text-[10px] tracking-wider text-purple-750 bg-purple-50 border border-purple-100/50 px-2.5 py-0.5 rounded-full font-bold">
                {transactions.length} ITEMS
              </span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {lastTransactions.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-12">No transactions recorded yet.</p>
              ) : (
                lastTransactions.map((tx) => {
                  const logo = getTransactionLogo(tx);
                  const isExpense = tx.type === "expense" || (tx.type === "transfer" && tx.treatAsExpense);
                  
                  return (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-3.5 bg-white border border-gray-100/80 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-purple-500/20 hover:shadow-sm transition-all duration-200 group"
                    >
                      {/* Left details */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-200">
                          {logo ? (
                            <img src={logo} alt="Account bank" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-gray-400">TX</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-gray-900 truncate" title={tx.description}>
                              {tx.description || "Untitled Transaction"}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold capitalize tracking-wide ${getCategoryTagStyles(tx.category || "", tx.type)}`}>
                              {tx.category || (tx.type === "transfer" ? "Transfer" : "Other")}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 font-semibold">
                            {tx.fromAccountName || tx.toAccountName || "Cash"} • {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>

                      {/* Right side amount */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0 pl-3">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                          {tx.type === "transfer" ? "Transfer" : isExpense ? "Expense" : "Income"}
                        </span>
                        <span className={`text-sm font-black ${isExpense ? "text-gray-900" : "text-emerald-600 animate-fadeIn"}`}>
                          {isExpense ? "-" : "+"}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 3: Upcoming snippet */}
          <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">Upcoming Dues</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/60 shadow-sm">
                <BellAlertIcon className="w-4.5 h-4.5" strokeWidth={2.2} />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
              {upcomingItems.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-12">No upcoming items due.</p>
              ) : (
                upcomingItems.map((item) => {
                  const logo = item.bank ? getAccountLogo(item.bank, item.name) : (item.name.toLowerCase().includes("spotify") ? "/subscription-apps/spotify.webp" : null);
                  return (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3.5 bg-white border border-gray-100/80 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-purple-500/20 hover:shadow-sm transition-all duration-200 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-200">
                          {logo ? (
                            <img src={logo} alt="Account bank" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl shrink-0">
                              {item.category === "Bills" ? "💵" : "📅"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 gap-0.5">
                          <span className="text-sm font-bold text-gray-900 truncate" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-xs text-gray-400 font-semibold truncate">
                            {item.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0 pl-3">
                        <DaysBadge days={item.daysRemaining} />
                        <span className={`text-sm font-black ${item.isIncome ? "text-emerald-600" : "text-gray-900"}`}>
                          {item.isIncome ? "+" : "-"}{formatCurrency(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column Stack */}
        <div className="flex flex-col gap-6">
          {/* Card 2: Wallet */}
          <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">Wallet</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60 shadow-sm">
                <WalletIcon className="w-4.5 h-4.5" strokeWidth={2.2} />
              </div>
            </div>

            {/* Everyday Balances */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">Everyday balances</span>
                  <span className="text-xs text-gray-400 font-semibold">{everydayAccounts.length} accounts</span>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-purple-600 transition-colors shadow-sm cursor-pointer">
                  <ArrowPathIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {everydayAccounts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4">No everyday accounts setup.</p>
                ) : (
                  everydayAccounts.map((acc) => {
                    const logo = getAccountLogo(acc.bank, acc.name);
                    return (
                      <div 
                        key={acc.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border ${getAccountTheme(acc.bank, acc.type)} shadow-[0_2px_12px_rgba(0,0,0,0.01)] group`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-white border border-white/80 shadow-sm flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-250">
                            {logo ? (
                              <img src={logo} alt={acc.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-gray-400">{acc.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 truncate">{acc.name}</span>
                            <span className="text-xs text-gray-500 font-semibold">{acc.type} • {acc.currency}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-black text-gray-900 transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
                          +{formatCurrency(acc.balance)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Credit and dues */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">Credit and dues</span>
                  <span className="text-xs text-gray-400 font-semibold">{creditAccounts.length} account</span>
                </div>
                <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-gray-150 text-gray-400 hover:text-purple-600 transition-colors shadow-sm cursor-pointer">
                  <ArrowPathIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {creditAccounts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-4">No credit accounts setup.</p>
                ) : (
                  creditAccounts.map((acc) => {
                    const logo = getAccountLogo(acc.bank, acc.name);
                    return (
                      <div 
                        key={acc.id}
                        className={`flex items-center justify-between p-3.5 rounded-2xl border ${getAccountTheme(acc.bank, acc.type)} shadow-[0_2px_12px_rgba(0,0,0,0.01)] group`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-white border border-white/80 shadow-sm flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-105 transition-transform duration-250">
                            {logo ? (
                              <img src={logo} alt={acc.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-gray-400">{acc.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 truncate">{acc.name}</span>
                            <span className="text-xs text-gray-500 font-semibold">{acc.type} • {acc.currency}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-black text-gray-900 transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
                          -{formatCurrency(acc.balance)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Card 4: Budget Watchlist */}
          <div className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">Budget Watchlist</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/60 shadow-sm">
                <ChartPieIcon className="w-4.5 h-4.5" strokeWidth={2.2} />
              </div>
            </div>

            <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
              {budgetWatchlist.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-12">No active budgets found.</p>
              ) : (
                budgetWatchlist.map((budget) => {
                  const isOver = budget.spent > budget.limit;
                  const isNear = budget.progress > 80 && !isOver;
                  
                  let barColor = "bg-gradient-to-r from-emerald-400 to-teal-500";
                  let textColor = "text-emerald-600";
                  let badgeText = "On Track";
                  let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100/30";

                  if (isOver) {
                    barColor = "bg-gradient-to-r from-red-500 to-rose-500 animate-pulse";
                    textColor = "text-red-500";
                    badgeText = "Over Limit";
                    badgeBg = "bg-red-50 text-red-700 border-red-100/30";
                  } else if (isNear) {
                    barColor = "bg-gradient-to-r from-amber-400 to-orange-500";
                    textColor = "text-amber-600";
                    badgeText = "Near Limit";
                    badgeBg = "bg-amber-50 text-amber-700 border-amber-100/30";
                  }

                  return (
                    <div 
                      key={budget.id}
                      className="p-3.5 bg-white border border-gray-100 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-purple-500/20 hover:shadow-sm transition-all duration-200 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {budget.icon && (
                            <span className="text-lg shrink-0">{budget.icon}</span>
                          )}
                          <span className="text-sm font-bold text-gray-900 truncate">
                            {budget.name}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize">
                            {budget.period}
                          </span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badgeBg}`}>
                          {badgeText}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-1">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                          style={{ width: `${Math.min(100, budget.progress)}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center text-xs mt-0.5">
                        <span className="text-gray-400 font-medium">
                          Spent {formatCurrency(budget.spent)}
                        </span>
                        <span className={`font-bold ${textColor}`}>
                          {isOver 
                            ? `${formatCurrency(budget.spent - budget.limit)} over` 
                            : `${formatCurrency(budget.limit - budget.spent)} left`
                          }
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
