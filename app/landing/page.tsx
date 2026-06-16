"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LandingPage() {
  const [monthlyBudget, setMonthlyBudget] = useState(3000);

  // Dynamic breakdown values
  const breakdown = [
    { name: "Bills & Housing", percentage: 35, color: "bg-purple-600", text: "text-purple-600", emoji: "🏠" },
    { name: "Savings & Investments", percentage: 20, color: "bg-indigo-600", text: "text-indigo-600", emoji: "📈" },
    { name: "Food & Groceries", percentage: 15, color: "bg-pink-500", text: "text-pink-500", emoji: "🍔" },
    { name: "Transport", percentage: 10, color: "bg-violet-500", text: "text-violet-500", emoji: "🚗" },
    { name: "Entertainment & Fun", percentage: 10, color: "bg-fuchsia-500", text: "text-fuchsia-500", emoji: "🍿" },
    { name: "Healthcare & Education", percentage: 10, color: "bg-deep-purple-500", text: "text-purple-500", emoji: "🏥" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 overflow-x-hidden font-sans selection:bg-purple-500 selection:text-white relative">
      {/* HERO SECTION MATCHING THE IMAGE LAYOUT (Purple Theme) */}
      <section className="relative min-h-[90vh] md:min-h-screen flex flex-col justify-between overflow-hidden bg-white">
        
        {/* Wave background SVG - extended to the top/header */}
        <div className="absolute right-[-100px] top-0 w-full lg:w-[65%] h-full pointer-events-none z-0">
          <svg viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full object-cover">
            {/* Wavy fluid shape */}
            <path d="M300 0 C 420 150, 320 300, 480 350 C 600 380, 520 480, 560 600 L 800 600 L 800 0 Z" fill="url(#purple-fluid)" />
            {/* Dotted paths overlay */}
            <path d="M350 0 C 470 180, 370 330, 530 380 C 650 410, 570 510, 610 600" stroke="#ffffff" strokeWidth="2" strokeDasharray="6 6" className="opacity-40" />
            <path d="M420 0 C 520 120, 460 220, 580 280" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="4 4" className="opacity-30" />
            <defs>
              <linearGradient id="purple-fluid" x1="300" y1="0" x2="800" y2="600" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="40%" stopColor="#818cf8" />
                <stop offset="70%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        {/* Top Navigation Header (matches image layout) */}
        <header className="relative z-30 w-full px-6 md:px-16 lg:px-24 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/nawi.png" alt="Nawi Logo" className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200" />
            <span className="text-2xl font-bold text-slate-800 tracking-tight">
              Nawi
            </span>
          </Link>

          {/* Navigation Links and Action Buttons */}
          <div className="flex items-center gap-6 md:gap-10">
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 lg:text-white/90">
              <a href="#features" className="hover:text-purple-600 lg:hover:text-purple-200 transition-colors">Features</a>
              <a href="#calculator" className="hover:text-purple-600 lg:hover:text-purple-200 transition-colors">Calculator</a>
              <a href="#privacy" className="hover:text-purple-600 lg:hover:text-purple-200 transition-colors">Privacy First</a>
            </nav>

            <div className="flex items-center gap-4">
              <Link 
                href="/" 
                className="px-6 py-2 rounded-full bg-slate-900 hover:bg-slate-850 text-xs md:text-sm font-bold text-white shadow-md transition-all hover:scale-105"
              >
                Log In
              </Link>
              
              {/* User Avatar circle like in the image */}
              <Link href="/" className="w-9 h-9 rounded-full bg-slate-100 lg:bg-white/10 border border-slate-200 lg:border-white/20 flex items-center justify-center text-slate-600 lg:text-white hover:bg-slate-200 lg:hover:bg-white/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Body Split */}
        <div className="flex-1 w-full px-6 md:px-16 lg:px-24 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 relative z-20 pb-12">
          
          {/* Left Side: Copy, SVGs, path, and Subscribe style button */}
          <div className="lg:col-span-5 flex flex-col gap-6 relative py-8 lg:py-16">
            
            {/* Connected Square Path Illustration - left side layout similar to cyan paths in image */}
            <div className="absolute left-[-20px] top-[10%] w-48 h-full pointer-events-none z-0 hidden sm:block">
              <svg width="200" height="400" viewBox="0 0 200 400" fill="none" xmlns="http://www.w3.org/2500/svg" className="opacity-90">
                {/* Connecting Curved Line */}
                <path d="M40 50 C -20 150, 40 250, 100 280 C 130 300, 160 280, 120 380" stroke="url(#line-grad)" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* Floating gradient rounded cards on the left matching image layout */}
              <div className="absolute left-[20px] top-[20px] w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/30 transform rotate-12 transition-transform hover:scale-110 duration-300" />
              <div className="absolute left-[-10px] top-[220px] w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-pink-500 shadow-md transform -rotate-12 transition-transform hover:scale-110 duration-300" />
              <div className="absolute left-[65px] top-[260px] w-10 h-10 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 shadow-lg shadow-purple-500/20 transform rotate-45 transition-transform hover:scale-110 duration-300" />
            </div>

            <div className="relative z-10 pl-0 sm:pl-10">
              <span className="text-sm font-semibold tracking-wider text-purple-600 uppercase mb-2 block">
                New Page / Design
              </span>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
                Nawi Budget Tracker
              </h1>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
                A premium, client-side finance application. Organize your assets, calculate compound interest, check visual metrics, and schedule recurring expenses with maximum data security.
              </p>

              {/* Pill CTA button matching the "Subscribe" style in image */}
              <div className="inline-flex items-center">
                <Link
                  href="/"
                  className="group flex items-center gap-3 p-1 pr-6 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5"
                >
                  <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-purple-600 transition-transform group-hover:translate-x-1 duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                  <span>Launch Workspace</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Side: Fluid Organic Wave Graphic and floating shapes matching image */}
          <div className="lg:col-span-7 h-full w-full relative min-h-[350px] sm:min-h-[500px] flex items-center justify-center">

            {/* Floating glassmorphic cards/squares on top of the fluid wave (matching image layout) */}
            <div className="relative w-full h-full z-10 flex items-center justify-end pr-8 sm:pr-24">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                {/* Floating translucent cards */}
                <div className="absolute top-[10%] right-[15%] w-16 h-16 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 shadow-xl transform rotate-12 animate-pulse duration-4000" />
                <div className="absolute top-[45%] right-[5%] w-12 h-12 rounded-lg bg-white/25 backdrop-blur-sm border border-white/20 shadow-lg transform -rotate-12" />
                <div className="absolute top-[65%] right-[25%] w-14 h-14 rounded-xl bg-white/15 backdrop-blur-md border border-white/10 shadow-lg transform rotate-45" />
                <div className="absolute top-[35%] right-[50%] w-10 h-10 rounded-lg bg-white/30 backdrop-blur-md border border-white/40 shadow-md transform rotate-6" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-24 border-t border-slate-100 bg-slate-50/50 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mb-4">
              Equipped for Smart Finance
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Nawi bundles professional financial utilities in a lightning-fast, intuitive layout designed for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl border border-slate-100 bg-white hover:border-purple-100 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Automated Cash Flow</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Log items to specific wallets (Bank, Cash, Savings) and track overall wealth with support for daily interest accretion.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl border border-slate-100 bg-white hover:border-purple-100 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Interactive Analytics</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Inspect category metrics, income-to-expense ratios, and asset distributions through gorgeous, modern chart renderers.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl border border-slate-100 bg-white hover:border-purple-100 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 mb-6 group-hover:scale-110 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Scheduled Planner</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Avoid penalty fees. Set upcoming recurrence dates for recurring bills or debts to automate scheduling logs easily.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Budget Calculator */}
      <section id="calculator" className="py-24 border-t border-slate-100 relative bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mb-6">
                Interactive Rules of Thumb
              </h2>
              <p className="text-slate-500 leading-relaxed mb-6">
                We believe in simple, clean frameworks for financial budgeting. Adjust the slider to see a recommended 50/30/20 & itemized allocation based on your target monthly budget.
              </p>
              <div className="p-6 rounded-2xl bg-purple-50/60 border border-purple-100/50">
                <div className="text-sm font-semibold text-purple-700 mb-2">Why allocation matters:</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Budgeting shouldn't be about constricting your lifestyle; it's about allocating funds intentionally so you can spend guilt-free on entertainment while hitting your long-term wealth goals.
                </p>
              </div>
            </div>

            {/* Slider Widget Card */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 shadow-xl shadow-slate-100/50 relative">
              <div className="flex justify-between items-center mb-8">
                <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Target Budget</span>
                <span className="text-3xl font-black text-purple-600 font-mono">${monthlyBudget.toLocaleString()}</span>
              </div>

              {/* Slider Component */}
              <div className="mb-10">
                <input
                  type="range"
                  min="1000"
                  max="15000"
                  step="500"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2 font-mono">
                  <span>$1,000</span>
                  <span>$8,000</span>
                  <span>$15,000</span>
                </div>
              </div>

              {/* Categories Display */}
              <div className="flex flex-col gap-4">
                {breakdown.map((item, index) => {
                  const allocatedAmount = (monthlyBudget * item.percentage) / 100;
                  return (
                    <div key={index} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="flex items-center gap-2 text-slate-700 font-medium">
                          <span>{item.emoji}</span>
                          <span>{item.name}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-slate-200/60 text-slate-500 px-2 py-0.5 rounded-full font-mono">{item.percentage}%</span>
                          <span className={`font-bold font-mono ${item.text}`}>${allocatedAmount.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-200/40 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section id="privacy" className="py-24 border-t border-slate-100 bg-slate-50/30 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 mb-8 border border-purple-100">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
          </div>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 mb-6">
            100% Client-Side. 100% Private.
          </h2>
          <p className="text-slate-500 leading-relaxed mb-8 max-w-2xl mx-auto">
            Nawi doesn't track you. All wallets, cash flow items, categories, and settings are saved securely on your device using a local browser database (IndexedDB). Your financial data never leaves your computer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <div className="text-purple-600 font-bold mb-1">Local database</div>
              <p className="text-xs text-slate-400">Saves your database offline with Dexie.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <div className="text-purple-600 font-bold mb-1">Backup & Restore</div>
              <p className="text-xs text-slate-400">Easily export or import your data as a JSON file.</p>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <div className="text-purple-600 font-bold mb-1">Zero cloud accounts</div>
              <p className="text-xs text-slate-400">No passwords or credentials required to start.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 border-t border-slate-100 bg-white relative">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-black text-center text-slate-900 mb-12">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-6">
            {[
              {
                q: "Is Nawi free to use?",
                a: "Yes, Nawi is open and completely free. Your browser stores the data locally on your computer."
              },
              {
                q: "Can I sync data across multiple devices?",
                a: "Since Nawi is fully offline-first for extreme privacy, automatic cloud sync is disabled. However, you can export a JSON backup file in settings and import it instantly on any desktop screen."
              },
              {
                q: "Where is my interest calculated?",
                a: "If you configure an interest rate on any of your wallets (like a high-yield savings account), Nawi's engine calculates the daily accretion locally on your computer every time you load the dashboard."
              }
            ].map((faq, idx) => (
              <div key={idx} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                <h3 className="font-bold text-slate-800 mb-2">{faq.q}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-24 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6">Take Control of Your Assets Today</h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto">
            Experience financial management with zero strings attached. Completely secure, private, and optimized for your screen.
          </p>
          <Link
            href="/"
            className="inline-block px-10 py-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 font-bold text-white transition-all shadow-xl shadow-purple-500/10 hover:shadow-purple-500/20 hover:-translate-y-0.5"
          >
            Launch Nawi Workspace
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100 bg-slate-50 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">N</span>
            </div>
            <span className="font-bold text-slate-600">Nawi Budget Tracker</span>
          </div>
          <div>© {new Date().getFullYear()} Nawi. All rights reserved. Private and Local-First.</div>
        </div>
      </footer>
    </div>
  );
}
