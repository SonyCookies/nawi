"use client";
 
import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import HomeView from "./components/views/HomeView";
import WalletView from "./components/views/WalletView";
import HistoryView from "./components/views/HistoryView";
import PlanView from "./components/views/PlanView";
import UpcomingView from "./components/views/UpcomingView";
import BudgetsView from "./components/views/BudgetsView";
import StatisticsView from "./components/views/StatisticsView";
import SettingsView from "./components/views/SettingsView";
import OwedView from "./components/views/OwedView";
import FAB from "./components/FAB";
import Toast from "./components/Toast";
import { db } from "./lib/db";
import { applyDailyInterest } from "./lib/interest";
 
export default function Home() {
  const [activeTab, setActiveTab] = useState("Wallet");
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Seed default categories and migrate existing ones
    const seedCategories = async () => {
      const count = await db.categories.count();
      if (count === 0) {
        await db.categories.bulkAdd([
          { name: "Bills", type: "expense", icon: "📄", sortOrder: 1 },
          { name: "Food", type: "expense", icon: "🍔", sortOrder: 2 },
          { name: "Transport", type: "expense", icon: "🚗", sortOrder: 3 },
          { name: "Shopping", type: "expense", icon: "🛒", sortOrder: 4 },
          { name: "Entertainment", type: "expense", icon: "🎬", sortOrder: 5 },
          { name: "Health", type: "expense", icon: "🏥", sortOrder: 6 },
          { name: "Education", type: "expense", icon: "🎓", sortOrder: 7 },
          { name: "Subscriptions", type: "expense", icon: "🔄", sortOrder: 8 },
          { name: "Other", type: "expense", icon: "📦", sortOrder: 9 }
        ]);
      } else {
        // Upgrade/migrate existing categories if type or icon is missing
        const allCats = await db.categories.toArray();
        for (const cat of allCats) {
          if (!cat.type || !cat.icon) {
            let icon = "📦";
            if (cat.name === "Bills") icon = "📄";
            else if (cat.name === "Food") icon = "🍔";
            else if (cat.name === "Transport") icon = "🚗";
            else if (cat.name === "Shopping") icon = "🛒";
            else if (cat.name === "Entertainment") icon = "🎬";
            else if (cat.name === "Health") icon = "🏥";
            else if (cat.name === "Education") icon = "🎓";
            else if (cat.name === "Subscriptions") icon = "🔄";

            await db.categories.update(cat.id!, {
              type: cat.type || "expense",
              icon: cat.icon || icon
            });
          }
        }
      }

      // Seed income categories
      const incomeCount = await db.categories.where("type").equals("income").count();
      if (incomeCount === 0) {
        await db.categories.bulkAdd([
          { name: "Salary / Wages", type: "income", icon: "💼", sortOrder: 1 },
          { name: "Freelance / Contract", type: "income", icon: "💻", sortOrder: 2 },
          { name: "Tips / Bonuses", type: "income", icon: "💰", sortOrder: 3 },
          { name: "Investments", type: "income", icon: "📈", sortOrder: 4 },
          { name: "Interests", type: "income", icon: "🏦", sortOrder: 5 },
          { name: "Rental Income", type: "income", icon: "🏠", sortOrder: 6 },
          { name: "Business Revenue", type: "income", icon: "🏢", sortOrder: 7 },
          { name: "Affiliate / Ad Revenue", type: "income", icon: "📢", sortOrder: 8 },
          { name: "Gifts / Awards", type: "income", icon: "🎁", sortOrder: 9 },
          { name: "Refunds / Reimbursements", type: "income", icon: "🔄", sortOrder: 10 },
          { name: "Grants / Allowances", type: "income", icon: "🎓", sortOrder: 11 },
          { name: "Other Income", type: "income", icon: "💵", sortOrder: 12 }
        ]);
      }
    };
    seedCategories().catch(console.error);
    applyDailyInterest().catch(console.error);

    // Listen for custom navigation events
    const handleNavigation = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setActiveTab(customEvent.detail);
    };
    window.addEventListener("navigate_tab", handleNavigation);
    return () => {
      window.removeEventListener("navigate_tab", handleNavigation);
    };
  }, []);

  // Track sidebar width so Toast can center in the main content area
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSidebarWidth(el.getBoundingClientRect().width);
    });
    observer.observe(el);
    setSidebarWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Mobile only warning overlay */}
      <div className="md:hidden flex flex-col items-center justify-center min-h-screen w-screen bg-slate-950 text-white p-8 text-center relative overflow-hidden">
        {/* Decorative blur blobs */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        
        {/* Premium Card */}
        <div className="z-10 max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-9 h-9 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
            </svg>
          </div>
          
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Best on Desktop</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Nawi Budget Tracker is optimized for larger screens to provide you with the best charting, transaction logs, and financial planning experience.
            </p>
          </div>
          
          <div className="text-[11px] text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3.5 py-1.5 rounded-full border border-indigo-500/20">
            Please switch to a desktop screen
          </div>
        </div>
      </div>

      {/* Main App Layout (Desktop) */}
      <div className="hidden md:flex flex-row h-screen w-screen overflow-hidden relative">
        <div ref={sidebarRef}>
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
        
        <main className="flex-1 overflow-y-auto px-10 py-8 bg-[#f8f9fa]">
          <div className="w-full">
            {activeTab === "Home" && <HomeView />}
            {activeTab === "Wallet" && <WalletView />}
            {activeTab === "History" && <HistoryView />}
            {activeTab === "Plan" && <PlanView />}
            {activeTab === "Plan:Upcoming" && <UpcomingView />}
            {activeTab === "Plan:Budgets" && <BudgetsView />}
            {activeTab === "Statistics" && <StatisticsView />}
            {activeTab === "Settings" && <SettingsView />}
            {activeTab === "Plan:Owed" && <OwedView />}
          </div>
        </main>

        {/* Global Floating Action Menu */}
        <FAB />

        {/* Global Toast Notification — centered within main content area */}
        <Toast sidebarWidth={sidebarWidth} />
      </div>
    </>
  );
}
