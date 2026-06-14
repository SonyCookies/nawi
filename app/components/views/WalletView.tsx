"use client";

import { useState, useEffect, useMemo } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account } from "../../lib/db";
import AddAccountModal from "../AddAccountModal";
import DeleteConfirmationModal from "../DeleteConfirmationModal";
import EditAccountModal from "../EditAccountModal";

interface BankTheme {
  image: string | null;
  gradient: string;
  textColor: string;
  subtextColor: string;
  btnColor: string;
}

export const BANK_THEMES: Record<string, Omit<BankTheme, "image">> = {
  bdo: {
    gradient: "from-[#002f6c] to-[#0056b3] shadow-blue-900/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  bpi: {
    gradient: "from-[#8a1538] to-[#590d22] shadow-red-950/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  gcash: {
    gradient: "from-[#0052e6] to-[#0080ff] shadow-blue-500/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  gotyme: {
    gradient: "from-[#03e8f4] to-[#00c5cf] shadow-cyan-300/25",
    textColor: "text-[#1a1921]",
    subtextColor: "text-[#1a1921]/70",
    btnColor: "text-[#1a1921]/80 hover:text-[#1a1921] hover:bg-black/5",
  },
  landbank: {
    gradient: "from-[#005b35] to-[#003c20] shadow-green-950/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  maribank: {
    gradient: "from-[#ff5722] to-[#e64a19] shadow-orange-600/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  maya: {
    gradient: "from-[#0c0c0c] to-[#1f1f1f] shadow-black/80 border-t border-emerald-500/30",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  metrobank: {
    gradient: "from-[#0038a8] to-[#001c57] shadow-blue-900/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  pnb: {
    gradient: "from-[#0f2d59] to-[#bf1e2e] shadow-slate-900/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  securitybank: {
    gradient: "from-[#002D62] via-[#004b87] to-[#84bd00] shadow-emerald-900/10",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  unionbank: {
    gradient: "from-[#ff6b00] to-[#d44b00] shadow-orange-600/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  tiktok: {
    gradient: "from-[#010101] to-[#121212] border-t border-[#fe0979]/40 border-b border-[#00f2fe]/40 shadow-black/80",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  shopee: {
    gradient: "from-[#ee4d2d] to-[#ff7337] shadow-orange-600/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
  wise: {
    gradient: "from-[#9fe870] to-[#7fcd52] shadow-green-400/20",
    textColor: "text-[#1d2729]",
    subtextColor: "text-[#1d2729]/70",
    btnColor: "text-[#1d2729]/80 hover:text-[#1d2729] hover:bg-black/5",
  },
  cash: {
    gradient: "from-[#11998e] to-[#38ef7d] shadow-emerald-500/20",
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  },
};

export const BANK_LOGOS: Record<string, string> = {
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

export const getBankTheme = (bankId: string | undefined, name: string, index: number): BankTheme => {
  // 1. Check if bankId matches explicitly
  if (bankId && bankId !== "other" && BANK_THEMES[bankId]) {
    return {
      image: BANK_LOGOS[bankId] || null,
      ...BANK_THEMES[bankId],
    };
  }

  // 2. Fallback to keyword matching in name (for backwards compatibility)
  const lowerName = name.toLowerCase();
  for (const [id, theme] of Object.entries(BANK_THEMES)) {
    let keywords = [id];
    if (id === "gotyme") keywords = ["gotyme", "go tyme"];
    else if (id === "landbank") keywords = ["landbank", "land bank"];
    else if (id === "maribank") keywords = ["maribank", "seabank", "mari bank", "sea bank"];
    else if (id === "metrobank") keywords = ["metrobank", "metro bank"];
    else if (id === "securitybank") keywords = ["securitybank", "security bank"];
    else if (id === "unionbank") keywords = ["unionbank", "union bank", "ubp"];
    else if (id === "shopee") keywords = ["shopee", "shopeepay", "shopee pay"];
    else if (id === "wise") keywords = ["wise", "transferwise"];
    else if (id === "cash") keywords = ["cash", "cash on hand", "wallet", "on hand"];

    if (keywords.some(kw => lowerName.includes(kw))) {
      return {
        image: BANK_LOGOS[id] || null,
        ...theme,
      };
    }
  }

  // 3. Fallbacks
  const defaultGradients = [
    "from-emerald-400 via-teal-500 to-cyan-500 shadow-teal-500/10",
    "from-amber-400 via-orange-500 to-red-500 shadow-orange-500/10",
    "from-sky-400 via-blue-500 to-indigo-600 shadow-blue-500/10",
    "from-pink-500 via-rose-500 to-purple-600 shadow-rose-500/10",
  ];

  return {
    image: null,
    gradient: defaultGradients[index % defaultGradients.length],
    textColor: "text-white",
    subtextColor: "text-white/70",
    btnColor: "text-white/80 hover:text-white hover:bg-white/10",
  };
};

const EMPTY_ACCOUNTS: Account[] = [];

export const getInitials = (name: string) => {
  if (name.toLowerCase().includes("cash")) return "💵";
  const words = name.split(" ");
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
};

export default function WalletView() {
  const [netWorthTab, setNetWorthTab] = useState("All");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: number; name: string } | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

  const [isHidden, setIsHidden] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("hide_balances") === "true";
    }
    return false;
  });

  const toggleHide = () => {
    const nextHidden = !isHidden;
    setIsHidden(nextHidden);
    localStorage.setItem("hide_balances", String(nextHidden));
    window.dispatchEvent(new CustomEvent("balance_visibility_changed", { detail: nextHidden }));
  };

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

  // Retrieve accounts from Dexie IndexedDB sorted by sortOrder
  const accounts = useLiveQuery(async () => {
    const list = await db.accounts.toArray();
    return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }) || EMPTY_ACCOUNTS;

  // Drag & drop sorting states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...displayAccounts];
    const [item] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, item);

    setDraggedIndex(index);
    setDisplayAccounts(reordered);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    // Persist final order mapping displayAccounts (filtered accounts) back to global list
    const allAccounts = [...accounts];
    const originalGlobalIndices = filteredAccounts.map(fa => allAccounts.findIndex(a => a.id === fa.id));

    originalGlobalIndices.forEach((globalIdx, i) => {
      if (globalIdx !== -1 && displayAccounts[i]) {
        allAccounts[globalIdx] = displayAccounts[i];
      }
    });

    try {
      await db.transaction("rw", db.accounts, async () => {
        for (let i = 0; i < allAccounts.length; i++) {
          if (allAccounts[i].id) {
            await db.accounts.update(allAccounts[i].id!, { sortOrder: i });
          }
        }
      });
    } catch (err) {
      console.error("Failed to update account sort orders:", err);
    }

    setDraggedIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Calculate Net Worth: Sum of accounts included in totals (assets minus liabilities)
  const isLiability = (acc: { type: string }) => acc.type === "Credit" || acc.type === "Paylater";

  const netWorth = accounts
    .filter((acc) => acc.includeInTotals)
    .reduce((sum, acc) => sum + (isLiability(acc) ? -Math.abs(acc.balance) : acc.balance), 0);

  // Total assets (non-liability accounts included in totals)
  const totalAssets = accounts
    .filter((acc) => acc.includeInTotals && !isLiability(acc))
    .reduce((sum, acc) => sum + acc.balance, 0);

  // Total liabilities (Credit + Paylater accounts included in totals)
  const totalLiabilities = accounts
    .filter((acc) => acc.includeInTotals && isLiability(acc))
    .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);

  // Total available credit (unused credit for Credit accounts included in totals)
  const totalAvailableCredit = accounts
    .filter((acc) => acc.includeInTotals && acc.type === "Credit" && acc.creditLimit !== undefined && acc.creditLimit > 0)
    .reduce((sum, acc) => sum + Math.max(0, (acc.creditLimit ?? 0) - Math.abs(acc.balance)), 0);

  // Total balance of all accounts
  const totalAccountsBalance = accounts.reduce((sum, acc) => sum + (isLiability(acc) ? -Math.abs(acc.balance) : acc.balance), 0);

  // Filter accounts for the card view based on selected tab memoized to stabilize references
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (netWorthTab === "All") return true;
      if (netWorthTab === "Assets") return !isLiability(acc);
      if (netWorthTab === "Liabilities") return isLiability(acc);
      if (netWorthTab === "Available Credit") return acc.type === "Credit";
      return true;
    });
  }, [accounts, netWorthTab]);

  const [displayAccounts, setDisplayAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (draggedIndex === null) {
      setDisplayAccounts((prev) => {
        if (
          prev.length === filteredAccounts.length &&
          prev.every(
            (acc, idx) =>
              acc.id === filteredAccounts[idx].id &&
              acc.name === filteredAccounts[idx].name &&
              acc.type === filteredAccounts[idx].type &&
              acc.balance === filteredAccounts[idx].balance &&
              acc.currency === filteredAccounts[idx].currency &&
              acc.includeInTotals === filteredAccounts[idx].includeInTotals &&
              acc.bank === filteredAccounts[idx].bank &&
              acc.creditLimit === filteredAccounts[idx].creditLimit &&
              acc.sortOrder === filteredAccounts[idx].sortOrder
          )
        ) {
          return prev;
        }
        return filteredAccounts;
      });
    }
  }, [filteredAccounts, draggedIndex]);

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


  if (accounts.length === 0) {
    return (
      <>
        <div className="animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 mb-1">Wallet</h1>
              <p className="text-gray-500 text-sm leading-relaxed mt-1">
                Review your wallet totals, switch between net worth views, and browse grouped account cards.
              </p>
            </div>
          </div>

          {/* Beautiful Empty State Panel */}
          <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] min-h-[420px]">
            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.75h.008v.008H9V9.75Zm.375 0h.007v.008h-.007V9.75Zm-.375 2.25H9v.008h.008V12Zm.375 0h.007v.008h-.007V12Zm-.375 2.25H9v.008h.008v-.008Zm.375 0h.007v.008h-.007v-.008Zm2.25-4.5h.008v.008H12V9.75Zm.375 0h.007v.008h-.007V9.75Zm-.375 2.25H12v.008h.008V12Zm.375 0h.007v.008h-.007V12Zm-.375 2.25H12v.008h.008v-.008Zm.375 0h.007v.008h-.007v-.008Zm2.25-4.5h.008v.008h-.008V9.75Zm.375 0h.007v.008h-.007V9.75Zm-.375 2.25H15v.008h.008V12Zm.375 0h.007v.008h-.007V12Zm-.375 2.25H15v.008h.008v-.008Zm.375 0h.007v.008h-.007v-.008Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No accounts listed yet</h2>
            <p className="text-gray-400 text-base max-w-sm mb-8 leading-relaxed">
              Create your first account to start tracking your net worth and balances in real-time.
            </p>
            <button
              onClick={() => setIsAddAccountOpen(true)}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
            >
              <PlusIcon className="w-6 h-6 text-white" strokeWidth={2} />
              <span>Create first account</span>
            </button>
          </div>
        </div>

        {/* Add Account Modal */}
        <AddAccountModal
          isOpen={isAddAccountOpen}
          onClose={() => setIsAddAccountOpen(false)}
        />
      </>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-1">Wallet</h1>
          <p className="text-gray-500 text-sm leading-relaxed mt-1">
            Review your wallet totals, switch between net worth views, and browse grouped account cards.
          </p>
        </div>
        <button
          onClick={() => setIsAddAccountOpen(true)}
          className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer animate-fadeIn"
        >
          <div className="flex items-center justify-center shrink-0">
            <PlusIcon className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <span>Add account</span>
        </button>
      </div>

      {/* Net Worth Section */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400 uppercase tracking-wider">
              {netWorthTab === "Assets"
                ? "Total Assets"
                : netWorthTab === "Liabilities"
                  ? "Total Liabilities"
                  : netWorthTab === "Available Credit"
                    ? "Available Credit"
                    : "Net Worth"}
            </span>
            <button
              onClick={toggleHide}
              className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
              title={isHidden ? "Show balances" : "Hide balances"}
            >
              {isHidden ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 flex-wrap gap-1">
            <button
              onClick={() => setNetWorthTab("All")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${netWorthTab === "All"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                : "text-gray-500 hover:text-gray-800"
                }`}
            >
              All
            </button>
            <button
              onClick={() => setNetWorthTab("Assets")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${netWorthTab === "Assets"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                : "text-gray-500 hover:text-gray-800"
                }`}
            >
              Assets
            </button>
            <button
              onClick={() => setNetWorthTab("Liabilities")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${netWorthTab === "Liabilities"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                : "text-gray-500 hover:text-gray-800"
                }`}
            >
              Liabilities
            </button>
            <button
              onClick={() => setNetWorthTab("Available Credit")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${netWorthTab === "Available Credit"
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/20"
                : "text-gray-500 hover:text-gray-800"
                }`}
            >
              Available Credit
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className={`text-5xl font-extrabold tracking-tight mb-1 transition-all duration-300 ${netWorthTab === "Liabilities"
                ? "text-red-500"
                : netWorthTab === "Available Credit"
                  ? "text-emerald-600"
                  : "text-gray-900"
              } ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>
              {netWorthTab === "Assets"
                ? formatNetWorth(totalAssets)
                : netWorthTab === "Liabilities"
                  ? formatNetWorth(totalLiabilities)
                  : netWorthTab === "Available Credit"
                    ? formatNetWorth(totalAvailableCredit)
                    : formatNetWorth(netWorth)}
            </div>
            <div className="text-sm text-gray-400 font-medium">
              {netWorthTab === "Assets"
                ? "Sum of all asset accounts"
                : netWorthTab === "Liabilities"
                  ? "Sum of all credit balances owed"
                  : netWorthTab === "Available Credit"
                    ? "Total unused credit across all cards"
                    : "Assets minus liabilities"}
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-50 px-4 py-2 rounded-full text-purple-700 font-bold text-sm">
            <span>{filteredAccounts.length} {filteredAccounts.length === 1 ? "Account" : "Accounts"}</span>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="flex items-center justify-start mb-4">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-gray-900">Accounts</span>
          <span className="text-sm text-gray-400">{filteredAccounts.length} {filteredAccounts.length === 1 ? "account" : "accounts"} listed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayAccounts.map((account, index) => {
          const theme = getBankTheme(account.bank, account.name, index);
          return (
            <div
              key={account.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br ${theme.gradient} ${theme.textColor} shadow-lg flex flex-col justify-between h-44 transition-all duration-200 cursor-grab active:cursor-grabbing ${draggedIndex === index
                  ? "opacity-30 scale-95"
                  : ""
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${theme.image ? "bg-white shadow-sm" : "bg-white/20"}`}>
                    {theme.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={theme.image}
                        alt={account.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-bold text-sm">
                        {getInitials(account.name)}
                      </span>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-base font-bold truncate max-w-[110px]" title={account.name}>{account.name}</div>
                    <div className={`text-[11px] ${theme.subtextColor} truncate`}>{account.type} • {account.currency}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setAccountToEdit(account);
                      setIsEditOpen(true);
                    }}
                    className={`${theme.btnColor} cursor-pointer transition-colors p-1 rounded`}
                    title="Edit account"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setAccountToDelete({ id: account.id!, name: account.name });
                      setIsDeleteOpen(true);
                    }}
                    className={`${theme.btnColor} cursor-pointer transition-colors p-1 rounded`}
                    title="Delete account"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                {account.type === "Credit" ? (
                  <>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                          Used Credit
                        </div>
                        <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(-Math.abs(account.balance))}</div>
                      </div>
                      {account.creditLimit !== undefined && account.creditLimit > 0 && (
                        <div className="text-right">
                          <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                            Available Credit
                          </div>
                          <div className={`text-sm font-bold truncate transition-all duration-300 ${isHidden ? "blur-sm select-none pointer-events-none" : ""}`}>
                            {formatNetWorth(account.creditLimit - Math.abs(account.balance))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Visual utilization bar */}
                    {account.creditLimit !== undefined && account.creditLimit > 0 && (
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="bg-white h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, (Math.abs(account.balance) / account.creditLimit) * 100)}%` }}
                        />
                      </div>
                    )}
                  </>
                ) : account.type === "Paylater" ? (
                  <>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                          Remaining Balance
                        </div>
                        <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(-Math.abs(account.balance))}</div>
                      </div>
                      {account.installmentTermMonths && account.balance > 0 && (
                        <div className="text-right">
                          <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                            Monthly ({account.installmentTermMonths}mo)
                          </div>
                          <div className={`text-sm font-bold truncate transition-all duration-300 ${isHidden ? "blur-sm select-none pointer-events-none" : ""}`}>
                            ₱{((account.customInstallmentPayments && account.customInstallmentPayments.length > 0)
                              ? account.customInstallmentPayments[0]
                              : (Math.abs(account.balance) / account.installmentTermMonths)
                            ).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Paylater installment progress bar */}
                    {account.installmentTermMonths && (
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                        <div className="bg-white/60 h-full rounded-full" style={{ width: "100%" }} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={`text-[10px] uppercase tracking-wider ${theme.subtextColor} mb-0.5`}>
                      Balance
                    </div>
                    <div className={`text-2xl font-black truncate transition-all duration-300 ${isHidden ? "blur-md select-none pointer-events-none" : ""}`}>{formatCurrency(account.balance)}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {displayAccounts.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-gray-100 text-gray-400 font-medium">
            No accounts found in this section. Click &quot;+ Add account&quot; to create one.
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setAccountToDelete(null);
        }}
        onConfirm={async () => {
          if (accountToDelete) {
            await db.accounts.delete(accountToDelete.id);
          }
        }}
        accountName={accountToDelete?.name || ""}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        key={accountToEdit?.id || "empty"}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setAccountToEdit(null);
        }}
        account={accountToEdit}
      />
    </div>
  );
}
