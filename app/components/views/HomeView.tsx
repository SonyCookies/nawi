"use client";

import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";

export default function HomeView() {
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_balances") === "true";
    }
    return false;
  });

  const [googleName, setGoogleName] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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

  // Retrieve accounts and transactions
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

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

  const netSavings = monthlyIncome - monthlyExpense;

  useEffect(() => {
    console.log("HomeView Diagnostic Log:", {
      totalTransactions: transactions.length,
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString(),
      monthlyIncome,
      monthlyExpense,
      netSavings,
      transactionsSample: transactions.slice(0, 5).map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        date: t.date,
        parsedDate: new Date(t.date).toISOString()
      }))
    });
  }, [transactions, startOfMonth, endOfMonth, monthlyIncome, monthlyExpense, netSavings]);

  const formattedDate = useMemo(() => {
    return now.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  }, [now]);

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  // Formatter helpers
  const formatCurrency = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `₱${formatted}`;
  };

  // 6-month historical calculations
  const chartData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleString("en-US", { month: "short" });
      
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      
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
        label: monthLabel,
        income: inc,
        expense: exp,
      });
    }
    return data;
  }, [transactions, now]);

  const maxVal = useMemo(() => {
    let max = 6000;
    chartData.forEach((d) => {
      if (d.income > max) max = d.income;
      if (d.expense > max) max = d.expense;
    });
    return Math.ceil(max / 6000) * 6000;
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
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] text-purple-600 uppercase tracking-widest leading-none">
          {formattedDate}
        </span>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          {googleName ? `${greeting}, ${googleName}!` : `${greeting}!`}
        </h1>
      </div>

      {/* Two Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
        
        {/* Left Column - In/Out Cards */}
        <div className="w-full lg:w-[32%] flex flex-col gap-4">
          
          {/* Out Card */}
          <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between h-[175px] relative overflow-hidden">
            <span className="absolute top-5 right-5 text-[11px] text-purple-700 uppercase bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full tracking-wider">
              OUT
            </span>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-gray-400 uppercase tracking-wider">This Month Out</span>
              <span className={`text-4xl font-black text-gray-900 leading-tight transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
                {formatCurrency(monthlyExpense)}
              </span>
            </div>
            <span className="text-[14px] text-gray-400">Logged spending in the current month</span>
          </div>

          {/* In Card (with a subtle purple tint) */}
          <div className="bg-purple-50/20 border border-purple-100/50 p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between h-[175px] relative overflow-hidden">
            <span className="absolute top-5 right-5 text-[11px] text-indigo-700 uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full tracking-wider">
              IN
            </span>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] text-gray-400 uppercase tracking-wider">This Month In</span>
              <span className={`text-4xl font-black text-gray-900 leading-tight transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
                {formatCurrency(monthlyIncome)}
              </span>
            </div>
            <span className="text-[14px] text-gray-400">Logged income in the current month</span>
          </div>

        </div>

        {/* Right Column - Cashflow Trend Graph */}
        <div className="w-full lg:w-[68%] bg-white border border-gray-100 p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-gray-400 uppercase tracking-wider">Cashflow</span>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">6-month trend</h2>
            </div>
            <span className="text-[12px] font-black text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full">
              PHP
            </span>
          </div>

          {/* Custom Pure-CSS Chart */}
          <div className="flex-1 min-h-[220px] flex flex-col gap-3 justify-end pt-3">
            {/* Grid Area */}
            <div className="flex-1 relative flex flex-col justify-between chart-container">
              {/* Horizontal grid lines */}
              {yAxisTicks.map((tick, idx) => (
                <div key={idx} className="w-full flex items-center gap-3 relative">
                  <span className="text-[12px] font-semibold text-gray-400 w-8 text-right shrink-0">
                    {formatTick(tick)}
                  </span>
                  <div className="flex-1 border-t border-gray-100/80" />
                </div>
              ))}

              {/* Follow Tooltip */}
              {hoveredIndex !== null && chartData[hoveredIndex] && (
                <div 
                  className="absolute bg-purple-950 text-white text-[13px] px-4 py-3 rounded-2xl shadow-xl border border-purple-800/30 whitespace-nowrap z-20 gap-2 flex flex-col pointer-events-none transition-all duration-75 animate-fadeIn"
                  style={{
                    left: `${mousePos.x}px`,
                    top: `${mousePos.y - 12}px`,
                    transform: 'translate(-50%, -100%)'
                  }}
                >
                  <div className="text-[11px] text-purple-300 border-b border-purple-800/60 pb-1.5 mb-0.5 text-center uppercase tracking-wider">
                    {chartData[hoveredIndex].label} Summary
                  </div>
                  <div className="flex justify-between gap-6 items-center">
                    <span className="text-purple-300">Incoming:</span>
                    <span className="text-white font-semibold">{formatCurrency(chartData[hoveredIndex].income)}</span>
                  </div>
                  <div className="flex justify-between gap-6 items-center">
                    <span className="text-purple-300">Outgoing:</span>
                    <span className="text-white font-semibold">{formatCurrency(chartData[hoveredIndex].expense)}</span>
                  </div>
                </div>
              )}              {/* Overlaid Bars Container */}
              <div className="absolute inset-y-0 left-11 right-0 flex justify-around items-end pb-0.5">
                {chartData.map((data, idx) => {
                  const incomeHeight = `${Math.min(100, (data.income / maxVal) * 100)}%`;
                  const expenseHeight = `${Math.min(100, (data.expense / maxVal) * 100)}%`;
                  const isHovered = hoveredIndex === idx;
                  const isAnyHovered = hoveredIndex !== null;
                  
                  return (
                    <div 
                      key={idx} 
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
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
                      className={`flex items-end gap-2.5 h-full w-[80px] justify-center relative cursor-pointer pb-2.5 rounded-2xl transition-all duration-200 ${
                        isAnyHovered 
                          ? isHovered 
                            ? "bg-purple-100/55 border border-purple-200/50 shadow-[0_8px_30px_rgb(124,58,237,0.06)] scale-[1.04] ring-1 ring-purple-600/10" 
                            : "opacity-40 scale-[0.97]"
                          : "hover:bg-purple-50/15"
                      }`}
                    >
                      {/* Income Bar (Purple) */}
                      <div 
                        className="w-4 bg-purple-600 rounded-t-sm transition-all"
                        style={{ height: incomeHeight }}
                      />

                      {/* Expense Bar (Light Purple) */}
                      <div 
                        className="w-4 bg-purple-200 rounded-t-sm transition-all"
                        style={{ height: expenseHeight }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex pl-11 justify-around text-[12px] font-semibold text-gray-400">
              {chartData.map((data, idx) => (
                <span key={idx} className="w-[80px] text-center">
                  {data.label}
                </span>
              ))}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
