"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db";
import { PresentationChartLineIcon } from "@heroicons/react/24/outline";

export default function StatisticsView() {
  const [hoveredPoint, setHoveredPoint] = useState<{
    tx: any;
    x: number;
    y: number;
    index: number;
  } | null>(null);

  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<{
    month: string;
    inflow: number;
    outflow: number;
    x: number;
    yIn: number;
    yOut: number;
    index: number;
  } | null>(null);

  // Retrieve accounts and transactions
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

  // Sort transactions chronologically
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (a.id || 0) - (b.id || 0);
    });
  }, [transactions]);

  // Net Worth History calculations
  const netWorthHistory = useMemo(() => {
    return sortedTransactions.filter((tx) => tx.netWorth !== undefined && tx.netWorth !== null);
  }, [sortedTransactions]);

  // Calculations for Summary Cards
  const totalInflow = useMemo(() => {
    return transactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalOutflow = useMemo(() => {
    return transactions.reduce((sum, tx) => {
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
  }, [transactions]);

  const netMovement = useMemo(() => {
    return totalInflow - totalOutflow;
  }, [totalInflow, totalOutflow]);

  // Top Category Calculation
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.forEach((tx) => {
      let amt = 0;
      if (tx.type === "expense") {
        amt = tx.amount;
      } else if (tx.type === "transfer") {
        if (tx.treatAsExpense) {
          amt = tx.amount;
        }
        if (tx.transferFee && tx.transferFee > 0) {
          // Attribute transfer fee to Category
          const feeCat = "Transfer Fee";
          map[feeCat] = (map[feeCat] || 0) + tx.transferFee;
        }
      }

      if (amt > 0) {
        const catName = tx.category || "Other";
        map[catName] = (map[catName] || 0) + amt;
      }
    });

    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const topCategory = useMemo(() => {
    if (categoryBreakdown.length === 0) return { name: "None", amount: 0 };
    return categoryBreakdown[0];
  }, [categoryBreakdown]);

  // Account activity list ordered by volume
  const accountActivityList = useMemo(() => {
    const volumeMap: Record<string, { name: string; volume: number }> = {};
    
    // Initialize accounts
    accounts.forEach((acc) => {
      if (acc.id) {
        volumeMap[acc.id] = { name: acc.name, volume: 0 };
      }
    });

    let unassignedVolume = 0;

    transactions.forEach((tx) => {
      let linked = false;
      if (tx.fromAccountId && volumeMap[tx.fromAccountId]) {
        volumeMap[tx.fromAccountId].volume += tx.amount;
        linked = true;
      }
      if (tx.toAccountId && volumeMap[tx.toAccountId]) {
        volumeMap[tx.toAccountId].volume += tx.amount;
        linked = true;
      }
      if (tx.type === "transfer" && tx.transferFee && tx.fromAccountId && volumeMap[tx.fromAccountId]) {
        volumeMap[tx.fromAccountId].volume += tx.transferFee;
      }
      
      // If no account is linked, map to Unassigned
      if (!linked) {
        unassignedVolume += tx.amount;
      }
    });

    const list = Object.values(volumeMap);
    if (unassignedVolume > 0) {
      list.push({ name: "Unassigned", volume: unassignedVolume });
    }

    return list.sort((a, b) => b.volume - a.volume);
  }, [accounts, transactions]);

  // Busiest Account Calculation (highest volume of transactions)
  const busiestAccount = useMemo(() => {
    if (accountActivityList.length === 0) return { name: "None", volume: 0 };
    return accountActivityList[0];
  }, [accountActivityList]);

  // Accent color mapping for the busiest account card
  const busiestAccountTheme = useMemo(() => {
    if (busiestAccount.name === "None" || busiestAccount.name === "Unassigned") {
      return {
        badge: "bg-gray-50 text-gray-700 border-gray-150/40",
        border: "hover:border-gray-300",
        bg: "bg-gray-50/20"
      };
    }
    const acc = accounts.find(a => a.name === busiestAccount.name);
    const bank = (acc?.bank || "").toLowerCase();
    const type = acc?.type || "";

    if (type === "Credit" || type === "Paylater") {
      return {
        badge: "bg-pink-50 text-pink-700 border-pink-100/30",
        border: "hover:border-pink-300/60",
        bg: "bg-[#fdf2f8]/40"
      };
    }
    if (bank === "bpi") {
      return {
        badge: "bg-red-50 text-red-700 border-red-100/30",
        border: "hover:border-red-300/60",
        bg: "bg-[#fef2f2]/40"
      };
    }
    if (bank === "cash" || busiestAccount.name.toLowerCase().includes("cash")) {
      return {
        badge: "bg-yellow-50 text-yellow-700 border-yellow-100/30",
        border: "hover:border-yellow-300/60",
        bg: "bg-[#fefce8]/40"
      };
    }
    if (bank === "gcash" || busiestAccount.name.toLowerCase().includes("gcash")) {
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-100/30",
        border: "hover:border-blue-300/60",
        bg: "bg-[#eff6ff]/40"
      };
    }
    if (bank === "bdo") {
      return {
        badge: "bg-blue-50 text-indigo-700 border-blue-100/30",
        border: "hover:border-blue-300/60",
        bg: "bg-[#eff6ff]/40"
      };
    }
    return {
      badge: "bg-purple-50 text-purple-700 border-purple-100/30",
      border: "hover:border-purple-300/60",
      bg: "bg-purple-50/20"
    };
  }, [busiestAccount, accounts]);

  // Accounts Activity Chart X-Axis Max
  const accountActivityMax = useMemo(() => {
    if (accountActivityList.length === 0) return 1000;
    const maxVal = Math.max(...accountActivityList.map((a) => a.volume), 1000);
    const rawMax = maxVal * 1.05;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const normalized = rawMax / magnitude;
    let rounded = 10;
    if (normalized <= 2) rounded = 2;
    else if (normalized <= 4) rounded = 4;
    else if (normalized <= 6) rounded = 6;
    else if (normalized <= 8) rounded = 8;
    else if (normalized <= 12) rounded = 12;
    else if (normalized <= 18) rounded = 18;
    else rounded = 24;
    return rounded * magnitude;
  }, [accountActivityList]);

  // Net Worth stats
  const latestNetWorth = useMemo(() => {
    if (netWorthHistory.length === 0) return 0;
    return netWorthHistory[netWorthHistory.length - 1].netWorth || 0;
  }, [netWorthHistory]);

  const stats = useMemo(() => {
    if (netWorthHistory.length === 0) {
      return { min: 0, max: 0, avg: 0, peak: 0, lowest: 0 };
    }
    const values = netWorthHistory.map((t) => t.netWorth || 0);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    return { min, max, avg, peak: max, lowest: min };
  }, [netWorthHistory]);

  const formatCurrency = (val: number) => {
    const formatted = Math.abs(val).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${val < 0 ? "-" : ""}₱${formatted}`;
  };

  // Dimensions & padding
  const width = 800;
  const height = 350;
  const padding = { top: 30, right: 30, bottom: 50, left: 70 };

  // Net Worth Chart points
  interface ChartDataPoint {
    x: number;
    y: number;
    tx: any;
    index: number;
  }

  interface ChartData {
    points: ChartDataPoint[];
    zeroY: number | null;
    yMin: number;
    yMax: number;
  }

  const chartData = useMemo<ChartData>(() => {
    if (netWorthHistory.length < 2) {
      return { points: [], zeroY: null, yMin: 0, yMax: 0 };
    }

    const xMax = netWorthHistory.length - 1;
    const yMinRaw = stats.lowest;
    const yMaxRaw = stats.peak;
    const range = yMaxRaw - yMinRaw;
    const margin = range === 0 ? 1000 : range * 0.1;
    const yMin = yMinRaw - margin;
    const yMax = yMaxRaw + margin;

    const points = netWorthHistory.map((tx, idx) => {
      const x = padding.left + (idx / xMax) * (width - padding.left - padding.right);
      const y =
        height -
        padding.bottom -
        (( (tx.netWorth || 0) - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);
      return { x, y, tx, index: idx };
    });

    let zeroY = null;
    if (yMin < 0 && yMax > 0) {
      zeroY =
        height -
        padding.bottom -
        ((0 - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);
    }

    return { points, zeroY, yMin, yMax };
  }, [netWorthHistory, stats, padding.left, padding.right, padding.top, padding.bottom]);

  const linePath = useMemo(() => {
    if (!chartData || !chartData.points || chartData.points.length === 0) return "";
    return chartData.points.map((p: ChartDataPoint, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [chartData]);

  const areaPath = useMemo(() => {
    if (!chartData || !chartData.points || chartData.points.length === 0) return "";
    const points = chartData.points;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseLineY = height - padding.bottom;
    return `${points.map((p: ChartDataPoint, i: number) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} L ${endX} ${baseLineY} L ${startX} ${baseLineY} Z`;
  }, [chartData, padding.bottom]);

  // Cashflow Trend Graph: Inflow vs Outflow over last 6 months
  const monthlyTrendData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const inflow = transactions
        .filter((tx) => tx.type === "income" && new Date(tx.date).getTime() >= start.getTime() && new Date(tx.date).getTime() <= end.getTime())
        .reduce((sum, tx) => sum + tx.amount, 0);

      const outflow = transactions
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

      data.push({ label, inflow, outflow });
    }
    return data;
  }, [transactions]);

  const trendMaxVal = useMemo(() => {
    let maxActual = 0;
    monthlyTrendData.forEach((d) => {
      if (d.inflow > maxActual) maxActual = d.inflow;
      if (d.outflow > maxActual) maxActual = d.outflow;
    });
    if (maxActual <= 0) return 10000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxActual)));
    const normalized = maxActual / magnitude;
    const rounded = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return rounded * magnitude;
  }, [monthlyTrendData]);

  const trendChartData = useMemo(() => {
    if (monthlyTrendData.length === 0) return { pointsIn: [], pointsOut: [], maxVal: 10000 };
    const xMax = monthlyTrendData.length - 1;
    const yMax = trendMaxVal;

    const pointsIn = monthlyTrendData.map((d, idx) => {
      const x = padding.left + (idx / xMax) * (width - padding.left - padding.right);
      const y = height - padding.bottom - (d.inflow / yMax) * (height - padding.top - padding.bottom);
      return { x, y, value: d.inflow, month: d.label };
    });

    const pointsOut = monthlyTrendData.map((d, idx) => {
      const x = padding.left + (idx / xMax) * (width - padding.left - padding.right);
      const y = height - padding.bottom - (d.outflow / yMax) * (height - padding.top - padding.bottom);
      return { x, y, value: d.outflow, month: d.label };
    });

    return { pointsIn, pointsOut, maxVal: yMax };
  }, [monthlyTrendData, trendMaxVal, padding.left, padding.right, padding.top, padding.bottom]);

  const trendInLinePath = useMemo(() => {
    return trendChartData.pointsIn.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [trendChartData]);

  const trendOutLinePath = useMemo(() => {
    return trendChartData.pointsOut.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [trendChartData]);

  const trendInAreaPath = useMemo(() => {
    if (trendChartData.pointsIn.length === 0) return "";
    const points = trendChartData.pointsIn;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseLineY = height - padding.bottom;
    return `${points.map((p) => `L ${p.x} ${p.y}`).join(" ").replace(/^L/, "M")} L ${endX} ${baseLineY} L ${startX} ${baseLineY} Z`;
  }, [trendChartData, padding.bottom]);

  const trendOutAreaPath = useMemo(() => {
    if (trendChartData.pointsOut.length === 0) return "";
    const points = trendChartData.pointsOut;
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseLineY = height - padding.bottom;
    return `${points.map((p) => `L ${p.x} ${p.y}`).join(" ").replace(/^L/, "M")} L ${endX} ${baseLineY} L ${startX} ${baseLineY} Z`;
  }, [trendChartData, padding.bottom]);

  // Doughnut Chart calculations
  const topCategories = useMemo(() => {
    return categoryBreakdown.slice(0, 5);
  }, [categoryBreakdown]);

  const categoryTotalSpending = useMemo(() => {
    return categoryBreakdown.reduce((sum, item) => sum + item.amount, 0);
  }, [categoryBreakdown]);

  const doughnutSegments = useMemo(() => {
    if (categoryTotalSpending === 0) return [];
    
    let accumulatedPercent = 0;
    const radius = 50;
    const circ = 2 * Math.PI * radius; // 314.159
    
    const colors = [
      "stroke-amber-500",
      "stroke-orange-500",
      "stroke-pink-500",
      "stroke-emerald-600",
      "stroke-blue-500"
    ];

    const bgColors = [
      "bg-amber-50 text-amber-900 border-amber-100",
      "bg-orange-50 text-orange-900 border-orange-100",
      "bg-pink-50 text-pink-900 border-pink-100",
      "bg-emerald-50 text-emerald-900 border-emerald-100",
      "bg-blue-50 text-blue-900 border-blue-100"
    ];

    const dotColors = [
      "bg-amber-500",
      "bg-orange-500",
      "bg-pink-500",
      "bg-emerald-600",
      "bg-blue-500"
    ];

    return topCategories.map((cat, idx) => {
      const percentage = cat.amount / categoryTotalSpending;
      const strokeLength = percentage * circ;
      const offset = circ - strokeLength + accumulatedPercent;
      accumulatedPercent -= strokeLength;

      return {
        ...cat,
        percentage,
        strokeDasharray: `${strokeLength} ${circ}`,
        strokeDashoffset: offset,
        color: colors[idx % colors.length],
        bgColor: bgColors[idx % bgColors.length],
        dotColor: dotColors[idx % dotColors.length]
      };
    });
  }, [topCategories, categoryTotalSpending]);

  const formatTick = (val: number) => {
    if (val === 0) return "0";
    if (val >= 1000) return `${val / 1000}K`;
    return val.toString();
  };

  const formatAxisLabel = (val: number) => {
    if (val === 0) return "0";
    if (val >= 1000000) return `${(val / 1000000).toFixed(0)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return val.toString();
  };

  return (
    <div className="animate-fadeIn flex flex-col gap-6 select-none">
      {/* Header */}
      <div className="flex flex-col gap-0.5 mb-2">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mt-1 mb-1">
          Financial Statistics
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mt-1">
          Monitor your cumulative net worth changes, monthly cashflow, and spending breakdowns.
        </p>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] text-center py-16">
          <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-purple-100/50">
            <PresentationChartLineIcon className="w-10 h-10" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No Transactions Logged</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Once you start adding transactions, the analytics and charts will populate here.
          </p>
        </div>
      ) : (
        <>
          {/* Top 4 Summary Cards (UpcomingView Redesign & Dynamic Wallet Accents) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Net Movement */}
            <div className="bg-white border border-gray-100 p-5 rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-emerald-300 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Net Movement</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full border font-black bg-emerald-50 text-emerald-700 border-emerald-100/30">
                  FLOW
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-2">
                <span className={`text-2xl font-black tracking-tight leading-none ${netMovement >= 0 ? "text-emerald-600 animate-fadeIn" : "text-red-600"}`}>
                  {netMovement >= 0 ? "+" : ""}{formatCurrency(netMovement)}
                </span>
                <span className="text-[11px] text-gray-400 font-semibold mt-1">Inflow minus Outflow</span>
              </div>
            </div>

            {/* Transactions Count */}
            <div className="bg-white border border-gray-100 p-5 rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-purple-300 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Transactions</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full border font-black bg-purple-50 text-purple-755 border-purple-100/30 font-semibold">
                  TOTAL
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-2">
                <span className="text-2xl font-black text-gray-900 tracking-tight leading-none">
                  {transactions.length}
                </span>
                <span className="text-[11px] text-gray-400 font-semibold mt-1">Transactions recorded</span>
              </div>
            </div>

            {/* Top Category */}
            <div className="bg-white border border-gray-100 p-5 rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:border-amber-300 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top Category</span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full border font-black bg-amber-50 text-amber-700 border-amber-100/30">
                  MOST SPENT
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-2">
                <span className="text-2xl font-black text-gray-900 tracking-tight leading-none truncate block max-w-full">
                  {topCategory.name}
                </span>
                <span className="text-[11px] text-gray-400 font-semibold mt-1">Total: {formatCurrency(topCategory.amount)}</span>
              </div>
            </div>

            {/* Busiest Account */}
            <div className={`border p-5 rounded-[24px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col justify-between transition-all duration-200 border-gray-100 ${busiestAccountTheme.bg} ${busiestAccountTheme.border} group`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Busiest Account</span>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-black transition-all duration-200 ${busiestAccountTheme.badge}`}>
                  ACTIVE
                </span>
              </div>
              <div className="flex flex-col gap-0.5 mt-2">
                <span className="text-2xl font-black text-gray-900 tracking-tight leading-none truncate block max-w-full">
                  {busiestAccount.name}
                </span>
                <span className="text-[11px] text-gray-400 font-semibold mt-1">Volume: {formatCurrency(busiestAccount.volume)}</span>
              </div>
            </div>
          </div>

          {/* Row 2: Inflow vs Outflow Trend (Left) & Spending by Category Doughnut (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Cashflow and Volume over time (8 cols) */}
            <div className="lg:col-span-7 bg-white border border-gray-100 rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4 relative">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">Trend</span>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">Cashflow and volume over time</h2>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
                  <PresentationChartLineIcon className="w-4.5 h-4.5" />
                </div>
              </div>

              <div className="relative w-full overflow-x-auto select-none mt-2">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto min-w-[550px] overflow-visible"
                >
                  <defs>
                    <linearGradient id="inflowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(217, 119, 6)" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="rgb(217, 119, 6)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Y-Axis Gridlines */}
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const ratio = idx / 4;
                    const val = trendChartData.maxVal - ratio * trendChartData.maxVal;
                    const y = padding.top + ratio * (height - padding.top - padding.bottom);
                    return (
                      <g key={idx} className="opacity-70">
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={width - padding.right}
                          y2={y}
                          stroke="#f3f4f6"
                          strokeWidth="1.5"
                        />
                        <text
                          x={padding.left - 12}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] font-bold fill-gray-400"
                        >
                          {formatTick(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Areas Fill */}
                  <path d={trendInAreaPath} fill="url(#inflowGradient)" />
                  <path d={trendOutAreaPath} fill="url(#outflowGradient)" />

                  {/* Inflow Line (Green) */}
                  <path
                    d={trendInLinePath}
                    fill="none"
                    stroke="rgb(16, 185, 129)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Outflow Line (Amber/Yellow) */}
                  <path
                    d={trendOutLinePath}
                    fill="none"
                    stroke="rgb(217, 119, 6)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Interactive Circles */}
                  {trendChartData.pointsIn.map((p, idx) => {
                    const pOut = trendChartData.pointsOut[idx];
                    return (
                      <g key={idx}>
                        {/* Green Point */}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={hoveredTrendPoint?.index === idx ? "6" : "4"}
                          className="fill-white stroke-emerald-600 cursor-pointer"
                          strokeWidth={hoveredTrendPoint?.index === idx ? "3" : "2"}
                          onMouseEnter={() => {
                            setHoveredTrendPoint({
                              month: p.month,
                              inflow: p.value,
                              outflow: pOut.value,
                              x: p.x,
                              yIn: p.y,
                              yOut: pOut.y,
                              index: idx
                            });
                          }}
                          onMouseLeave={() => setHoveredTrendPoint(null)}
                        />
                        {/* Outflow Point */}
                        <circle
                          cx={pOut.x}
                          cy={pOut.y}
                          r={hoveredTrendPoint?.index === idx ? "6" : "4"}
                          className="fill-white stroke-amber-600 cursor-pointer"
                          strokeWidth={hoveredTrendPoint?.index === idx ? "3" : "2"}
                          onMouseEnter={() => {
                            setHoveredTrendPoint({
                              month: p.month,
                              inflow: p.value,
                              outflow: pOut.value,
                              x: p.x,
                              yIn: p.y,
                              yOut: pOut.y,
                              index: idx
                            });
                          }}
                          onMouseLeave={() => setHoveredTrendPoint(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* X-Axis Labels */}
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2 px-16">
                  <span>{monthlyTrendData[0]?.label}</span>
                  <span>{monthlyTrendData[monthlyTrendData.length - 1]?.label}</span>
                </div>

                {/* Trend Tooltip Overlay */}
                {hoveredTrendPoint && (
                  <div
                    className="absolute bg-purple-950 text-white text-[13px] px-4 py-3 rounded-2xl shadow-xl border border-purple-900/30 whitespace-nowrap z-25 gap-2 flex flex-col pointer-events-none transition-all duration-75 animate-fadeIn"
                    style={{
                      left: `${(hoveredTrendPoint.x / width) * 100}%`,
                      top: `${((hoveredTrendPoint.yIn + hoveredTrendPoint.yOut) / 2 / height) * 100 - 5}%`,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <div className="text-[10px] text-purple-305 border-b border-purple-800/60 pb-1 text-center uppercase tracking-wider font-bold">
                      {hoveredTrendPoint.month}
                    </div>
                    <div className="flex justify-between gap-6 items-center">
                      <span className="text-emerald-400 font-medium">Inflow:</span>
                      <span className="text-white font-bold">{formatCurrency(hoveredTrendPoint.inflow)}</span>
                    </div>
                    <div className="flex justify-between gap-6 items-center">
                      <span className="text-amber-400 font-medium">Outflow:</span>
                      <span className="text-white font-bold">{formatCurrency(hoveredTrendPoint.outflow)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Spending by Category Doughnut (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-gray-100 rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">Breakdown</span>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">Spending by category</h2>
                </div>
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Top 5
                </span>
              </div>

              {categoryTotalSpending === 0 ? (
                <div className="text-center text-gray-400 italic py-16 text-sm">
                  No spending categories found.
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6 mt-4 flex-1">
                  {/* SVG Doughnut */}
                  <div className="relative w-32 h-32 shrink-0">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      {/* Underlay base circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="transparent"
                        stroke="#f3f4f6"
                        strokeWidth="12"
                      />
                      {doughnutSegments.map((seg, idx) => (
                        <circle
                          key={idx}
                          cx="60"
                          cy="60"
                          r="50"
                          fill="transparent"
                          className={seg.color}
                          strokeWidth="12"
                          strokeDasharray={seg.strokeDasharray}
                          strokeDashoffset={seg.strokeDashoffset}
                          strokeLinecap="round"
                        />
                      ))}
                    </svg>
                  </div>

                  {/* Categories List */}
                  <div className="flex-1 flex flex-col gap-2 w-full">
                    {doughnutSegments.map((seg, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-xl border border-transparent hover:border-gray-100 ${seg.bgColor} transition-colors`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${seg.dotColor}`} />
                          <span className="text-xs font-bold text-gray-900 truncate">
                            {seg.name}
                          </span>
                        </div>
                        <span className="text-xs font-black text-gray-900 pl-2">
                          {formatCurrency(seg.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Row 3: Net Worth Line Chart & History Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Net Worth Chart (8 cols) */}
            <div className="lg:col-span-7 bg-white border border-gray-100 rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4 relative">
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-purple-600 uppercase tracking-wider font-semibold">Net Worth Trend</span>
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight">Transaction-by-Transaction Plot</h2>
                </div>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full tracking-wider">
                  {netWorthHistory.length} TXS
                </span>
              </div>

              {netWorthHistory.length < 2 ? (
                <div className="text-center text-gray-400 italic py-16 text-sm">
                  Need at least 2 logged transactions with net worth values to draw a trend line.
                </div>
              ) : (
                <div className="relative w-full overflow-x-auto select-none mt-2">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-auto min-w-[550px] overflow-visible"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(147, 51, 234)" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="rgb(147, 51, 234)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis Horizontal Grid Lines & Ticks */}
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const ratio = idx / 4;
                      const val = chartData.yMax - ratio * (chartData.yMax - chartData.yMin);
                      const y = padding.top + ratio * (height - padding.top - padding.bottom);
                      return (
                        <g key={idx} className="opacity-70">
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={width - padding.right}
                            y2={y}
                            stroke="#f3f4f6"
                            strokeWidth="1.5"
                            strokeDasharray={idx === 4 || idx === 0 ? "0" : "4 4"}
                          />
                          <text
                            x={padding.left - 12}
                            y={y + 4}
                            textAnchor="end"
                            className="text-[10px] font-bold fill-gray-400"
                          >
                            {formatCurrency(val)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Zero-Line highlighting if it spans negative numbers */}
                    {chartData.zeroY !== null && (
                      <g>
                        <line
                          x1={padding.left}
                          y1={chartData.zeroY}
                          x2={width - padding.right}
                          y2={chartData.zeroY}
                          stroke="#e5e7eb"
                          strokeWidth="2"
                          strokeDasharray="2 2"
                        />
                        <text
                          x={width - padding.right - 8}
                          y={chartData.zeroY - 6}
                          textAnchor="end"
                          className="text-[9px] font-black fill-gray-300 uppercase tracking-widest"
                        >
                          Zero Level
                        </text>
                      </g>
                    )}

                    {/* Gradient Area Fill */}
                    <path d={areaPath} fill="url(#chartGradient)" />

                    {/* Trend Line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="rgb(147, 51, 234)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Circles/Points */}
                    {chartData.points.map((p: ChartDataPoint, idx: number) => (
                      <circle
                        key={idx}
                        cx={p.x}
                        cy={p.y}
                        r={hoveredPoint?.index === idx ? "7" : "4.5"}
                        className="fill-white stroke-purple-600 cursor-pointer transition-all duration-150"
                        strokeWidth={hoveredPoint?.index === idx ? "3.5" : "2.5"}
                        onMouseEnter={() => {
                          setHoveredPoint({
                            tx: p.tx,
                            x: p.x,
                            y: p.y,
                            index: idx
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}
                  </svg>

                  {/* Point Hover Tooltip Overlay */}
                  {hoveredPoint && (
                    <div
                      className="absolute bg-purple-950 text-white text-[13px] px-4 py-3.5 rounded-2xl shadow-xl border border-purple-900/30 whitespace-nowrap z-25 gap-2.5 flex flex-col pointer-events-none transition-all duration-75 animate-fadeIn"
                      style={{
                        left: `${(hoveredPoint.x / width) * 100}%`,
                        top: `${(hoveredPoint.y / height) * 100 - 6}%`,
                        transform: 'translate(-50%, -100%)'
                      }}
                    >
                      <div className="text-[10px] text-purple-300 border-b border-purple-800/60 pb-1.5 mb-0.5 text-center uppercase tracking-wider font-bold">
                        Tx #{hoveredPoint.index + 1} details
                      </div>
                      <div className="flex justify-between gap-6 items-center">
                        <span className="text-purple-250 font-medium">Description:</span>
                        <span className="text-white font-bold max-w-[150px] truncate">
                          {hoveredPoint.tx.description || "Untitled"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-6 items-center">
                        <span className="text-purple-250 font-medium">Tx Type:</span>
                        <span className="text-white font-bold capitalize">
                          {hoveredPoint.tx.type}
                        </span>
                      </div>
                      <div className="flex justify-between gap-6 items-center">
                        <span className="text-purple-250 font-medium">Tx Date:</span>
                        <span className="text-white font-bold">
                          {new Date(hoveredPoint.tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-6 items-center">
                        <span className="text-purple-250 font-medium">Tx Amount:</span>
                        <span className={`font-bold ${hoveredPoint.tx.type === "income" ? "text-emerald-400" : "text-purple-200"}`}>
                          {hoveredPoint.tx.type === "income" ? "+" : "-"}{formatCurrency(hoveredPoint.tx.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-6 items-center border-t border-purple-800/60 pt-1.5 mt-0.5">
                        <span className="text-purple-300 font-bold">Net Worth:</span>
                        <span className="text-white font-black text-sm">
                          {formatCurrency(hoveredPoint.tx.netWorth || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accounts activity (Where activity happens most) (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-gray-100 rounded-3xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] flex flex-col gap-4">
              <div className="flex justify-between items-center mb-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-gray-400 uppercase tracking-wider font-bold">Accounts</span>
                  <h2 className="text-lg font-bold text-gray-950 tracking-tight">Where activity happens most</h2>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Amount
                </span>
              </div>

              {accountActivityList.length === 0 ? (
                <div className="text-center text-gray-400 italic py-16 text-sm">
                  No account activity found.
                </div>
              ) : (
                <div className="flex flex-col gap-5 mt-4 relative flex-1">
                  {/* Grid Lines in background */}
                  <div className="absolute inset-y-0 left-24 right-0 flex justify-between pointer-events-none pb-6">
                    <div className="border-l border-gray-100/70 h-full" />
                    <div className="border-l border-gray-100/70 h-full" />
                    <div className="border-l border-gray-100/70 h-full" />
                    <div className="border-l border-gray-100/70 h-full" />
                    <div className="border-l border-gray-100/70 h-full" />
                  </div>

                  {/* Account Activity Rows */}
                  <div className="flex flex-col gap-5 relative z-10">
                    {accountActivityList.slice(0, 5).map((acc, idx) => {
                      const widthPercent = Math.min(100, (acc.volume / accountActivityMax) * 100);
                      const barColors = [
                        "bg-[#14b8a6]", // Teal/Green
                        "bg-[#f59e0b]", // Amber/Orange
                        "bg-[#0ea5e9]", // Blue (GCash)
                        "bg-[#94a3b8]", // Slate/Gray (Unassigned)
                        "bg-[#ec4899]"  // Pink (BDO Visa)
                      ];
                      const barBg = barColors[idx % barColors.length];

                      return (
                        <div key={idx} className="flex items-center">
                          {/* Account Label */}
                          <span className="w-24 text-right pr-4 text-xs font-bold text-gray-500 truncate" title={acc.name}>
                            {acc.name}
                          </span>
                          
                          {/* Bar Container */}
                          <div className="flex-1 h-8 flex items-center relative">
                            <div
                              className={`h-5 rounded-full transition-all duration-500 ${barBg}`}
                              style={{ width: `${widthPercent}%` }}
                              title={formatCurrency(acc.volume)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-Axis Labels aligned with the vertical grid lines */}
                  <div className="flex text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2 border-t border-gray-50 pt-2">
                    <div className="w-24 shrink-0" />
                    <div className="flex-1 flex justify-between pr-0.5">
                      <span>0</span>
                      <span>{formatAxisLabel(accountActivityMax * 0.25)}</span>
                      <span>{formatAxisLabel(accountActivityMax * 0.5)}</span>
                      <span>{formatAxisLabel(accountActivityMax * 0.75)}</span>
                      <span>{formatAxisLabel(accountActivityMax)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
