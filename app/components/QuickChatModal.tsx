"use client";

import { useState, useEffect } from "react";
import { XMarkIcon, CheckIcon, ChatBubbleOvalLeftIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type Account } from "../lib/db";

interface QuickChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedTransaction {
  type: "transfer" | "income" | "expense" | null;
  amount: number | null;
  description: string;
  fromAccount: Account | null;
  toAccount: Account | null;
  isValid: boolean;
}

const EMPTY_ACCOUNTS: Account[] = [];

export default function QuickChatModal({ isOpen, onClose }: QuickChatModalProps) {
  const [inputText, setInputText] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction>({
    type: null,
    amount: null,
    description: "",
    fromAccount: null,
    toAccount: null,
    isValid: false
  });

  const accounts = useLiveQuery(() => db.accounts.toArray()) || EMPTY_ACCOUNTS;

  const examples = [
    "spent 150 for lunch from Cash on Hand",
    "transfer 1000 from GCash to BDO Savings",
    "received 45000 from salary to BPI",
    "spent 280 for Starbucks from Maya"
  ];

  // Helper to match string to an existing account
  const findMatchingAccount = (searchStr: string): Account | null => {
    if (!searchStr) return null;
    const cleanSearch = searchStr.trim().toLowerCase();
    
    // 1. Direct match (exact lowercase name or bank id)
    let matched = accounts.find(acc => acc.name.toLowerCase() === cleanSearch || acc.bank?.toLowerCase() === cleanSearch);
    if (matched) return matched;

    // 2. Starts with / Ends with / Includes match
    matched = accounts.find(acc => acc.name.toLowerCase().includes(cleanSearch) || cleanSearch.includes(acc.name.toLowerCase()));
    if (matched) return matched;

    // 3. Bank keyword matching fallback
    matched = accounts.find(acc => {
      if (!acc.bank) return false;
      const bankKeywords: Record<string, string[]> = {
        bdo: ["bdo"],
        bpi: ["bpi"],
        gcash: ["gcash"],
        gotyme: ["gotyme", "go tyme"],
        landbank: ["landbank", "land bank"],
        maribank: ["maribank", "seabank", "mari bank", "sea bank"],
        maya: ["maya"],
        metrobank: ["metrobank", "metro bank"],
        pnb: ["pnb"],
        securitybank: ["securitybank", "security bank"],
        unionbank: ["unionbank", "union bank", "ubp"],
        tiktok: ["tiktok", "tik tok"],
        shopee: ["shopee", "shopeepay", "shopee pay"],
        wise: ["wise", "transferwise"],
        cash: ["cash", "cash on hand", "wallet", "on hand"]
      };
      const keywords = bankKeywords[acc.bank] || [acc.bank];
      return keywords.some(kw => cleanSearch.includes(kw) || kw.includes(cleanSearch));
    });

    return matched || null;
  };

  useEffect(() => {
    if (!inputText.trim()) {
      setParsed({ type: null, amount: null, description: "", fromAccount: null, toAccount: null, isValid: false });
      return;
    }

    const text = inputText.trim();
    let type: "transfer" | "income" | "expense" | null = null;
    let amount: number | null = null;
    let description = "";
    let fromAccount: Account | null = null;
    let toAccount: Account | null = null;

    // 1. Check for Transfer pattern:
    // "transfer 500 from GCash to BDO"
    const transferRegex = /(?:transfer|move|send)\s+([\d,.]+)\s+(?:from)?\s*(.*?)\s+to\s+(.*)/i;
    const transferMatch = text.match(transferRegex);

    if (transferMatch) {
      type = "transfer";
      amount = parseFloat(transferMatch[1].replace(/,/g, ""));
      fromAccount = findMatchingAccount(transferMatch[2]);
      toAccount = findMatchingAccount(transferMatch[3]);
      description = `Transfer from ${fromAccount?.name || transferMatch[2]} to ${toAccount?.name || transferMatch[3]}`;
    }

    // 2. Check for Expense pattern:
    // "spent 150 for lunch from Cash on Hand" or "paid 2000 electricity from BDO"
    if (!type) {
      const expenseRegex = /(?:spent|paid|buy|expense|cost)\s+([\d,.]+)\s+(?:for|on)?\s*(.*?)\s+from\s+(.*)/i;
      const expenseMatch = text.match(expenseRegex);
      if (expenseMatch) {
        type = "expense";
        amount = parseFloat(expenseMatch[1].replace(/,/g, ""));
        description = expenseMatch[2] ? expenseMatch[2].trim() : "Expense";
        fromAccount = findMatchingAccount(expenseMatch[3]);
      }
    }

    // 3. Check for Income pattern:
    // "received 45,000 from salary to BPI" or "earned 500 gift to GCash"
    if (!type) {
      const incomeRegex = /(?:received|earned|income|add|deposit)\s+([\d,.]+)\s+(?:from|for)?\s*(.*?)\s+to\s+(.*)/i;
      const incomeMatch = text.match(incomeRegex);
      if (incomeMatch) {
        type = "income";
        amount = parseFloat(incomeMatch[1].replace(/,/g, ""));
        description = incomeMatch[2] ? incomeMatch[2].trim() : "Income";
        toAccount = findMatchingAccount(incomeMatch[3]);
      }
    }

    // Validate parsing
    const isValid = !!(
      type &&
      amount &&
      amount > 0 &&
      (type === "transfer" ? (fromAccount && toAccount && fromAccount.id !== toAccount.id) : true) &&
      (type === "expense" ? !!fromAccount : true) &&
      (type === "income" ? !!toAccount : true)
    );

    setParsed({ type, amount, description, fromAccount, toAccount, isValid });
  }, [inputText, accounts]);

  const handleSave = async () => {
    if (!parsed.isValid || !parsed.type || !parsed.amount) return;

    try {
      await db.transaction("rw", [db.accounts, db.transactions], async () => {
        const amt = parsed.amount!;
        
        if (parsed.type === "transfer" && parsed.fromAccount?.id && parsed.toAccount?.id) {
          const fromAcc = await db.accounts.get(parsed.fromAccount.id);
          const toAcc = await db.accounts.get(parsed.toAccount.id);
          if (fromAcc && toAcc) {
            const updatedFromBalance = fromAcc.balance - amt;
            const updatedToBalance = toAcc.balance + amt;

            await db.accounts.update(fromAcc.id!, { balance: updatedFromBalance });
            await db.accounts.update(toAcc.id!, { balance: updatedToBalance });

            const allAccs = await db.accounts.toArray();
            const currentNetWorth = allAccs
              .filter((acc) => acc.includeInTotals)
              .reduce((sum, acc) => sum + (acc.type === "Credit" ? -Math.abs(acc.balance) : acc.balance), 0);

            await db.transactions.add({
              type: "transfer",
              amount: amt,
              description: parsed.description,
              fromAccountId: fromAcc.id,
              toAccountId: toAcc.id,
              fromAccountName: fromAcc.name,
              toAccountName: toAcc.name,
              date: new Date(),
              category: toAcc.type === "Credit" ? "Credit Payment" : undefined,
              netWorth: currentNetWorth,
              fromAccountBalance: updatedFromBalance,
              toAccountBalance: updatedToBalance
            });
          }
        } else if (parsed.type === "expense" && parsed.fromAccount?.id) {
          const fromAcc = await db.accounts.get(parsed.fromAccount.id);
          if (fromAcc) {
            const updatedFromBalance = fromAcc.balance - amt;

            await db.accounts.update(fromAcc.id!, { balance: updatedFromBalance });

            const allAccs = await db.accounts.toArray();
            const currentNetWorth = allAccs
              .filter((acc) => acc.includeInTotals)
              .reduce((sum, acc) => sum + (acc.type === "Credit" ? -Math.abs(acc.balance) : acc.balance), 0);

            await db.transactions.add({
              type: "expense",
              amount: amt,
              description: parsed.description || "Expense",
              fromAccountId: fromAcc.id,
              fromAccountName: fromAcc.name,
              date: new Date(),
              netWorth: currentNetWorth,
              fromAccountBalance: updatedFromBalance
            });
          }
        } else if (parsed.type === "income" && parsed.toAccount?.id) {
          const toAcc = await db.accounts.get(parsed.toAccount.id);
          if (toAcc) {
            const updatedToBalance = toAcc.balance + amt;

            await db.accounts.update(toAcc.id!, { balance: updatedToBalance });

            const allAccs = await db.accounts.toArray();
            const currentNetWorth = allAccs
              .filter((acc) => acc.includeInTotals)
              .reduce((sum, acc) => sum + (acc.type === "Credit" ? -Math.abs(acc.balance) : acc.balance), 0);

            await db.transactions.add({
              type: "income",
              amount: amt,
              description: parsed.description || "Income",
              toAccountId: toAcc.id,
              toAccountName: toAcc.name,
              date: new Date(),
              netWorth: currentNetWorth,
              toAccountBalance: updatedToBalance
            });
          }
        }
      });

      setInputText("");
      onClose();
    } catch (err) {
      console.error("Error saving quick transaction:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="w-full max-w-[550px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5 max-w-[90%]">
            <div className="flex items-center gap-2">
              <ChatBubbleOvalLeftIcon className="w-7 h-7 text-[#d97706]" strokeWidth={2.2} />
              <h2 className="text-2xl font-bold text-gray-900 leading-none">Quick Chat Transaction</h2>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mt-1">
              Type transaction details in plain English, and we will extract the values automatically.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer animate-rotateIn"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Input area */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium tracking-wide text-gray-500">What did you do?</label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm min-h-[90px] resize-none"
            placeholder="e.g. spent 150 for coffee from GCash"
          />

          {/* Examples list */}
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Try typing:</span>
            <div className="flex flex-wrap gap-1.5">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setInputText(ex)}
                  className="text-xs bg-gray-100 hover:bg-gray-200/80 text-gray-600 px-3 py-1.5 rounded-lg font-medium cursor-pointer transition-colors border border-gray-200/30"
                >
                  &quot;{ex}&quot;
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Parsing Output card */}
        {inputText.trim() && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 animate-fadeInSimple">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Live Parsing Preview</span>
            
            {parsed.type ? (
              <div className="flex flex-col gap-2.5">
                {/* Transaction details row */}
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs uppercase tracking-wider ${
                    parsed.type === "income" ? "bg-green-100 text-green-700" :
                    parsed.type === "expense" ? "bg-red-100 text-red-700" :
                    "bg-indigo-100 text-indigo-700"
                  }`}>
                    {parsed.type}
                  </span>
                  {parsed.amount !== null && !isNaN(parsed.amount) && (
                    <span className="text-xl font-extrabold text-gray-900">
                      ₱{parsed.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {/* Description */}
                <div className="text-sm text-gray-700 font-semibold">
                  <span className="text-gray-400 font-medium">Description:</span> {parsed.description}
                </div>

                {/* Accounts matched */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                  {/* Source Account */}
                  {(parsed.type === "transfer" || parsed.type === "expense") && (
                    <div className="flex flex-col gap-1 p-2.5 bg-white border border-gray-100 rounded-xl">
                      <span className="text-[10px] text-gray-400 uppercase">From Account</span>
                      {parsed.fromAccount ? (
                        <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                          {parsed.fromAccount.name}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-semibold animate-pulse">❓ Match account in text</span>
                      )}
                    </div>
                  )}

                  {/* Destination Account */}
                  {(parsed.type === "transfer" || parsed.type === "income") && (
                    <div className="flex flex-col gap-1 p-2.5 bg-white border border-gray-100 rounded-xl">
                      <span className="text-[10px] text-gray-400 uppercase">To Account</span>
                      {parsed.toAccount ? (
                        <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                          {parsed.toAccount.name}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-600 font-semibold animate-pulse">❓ Match account in text</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400 italic font-medium">
                Unable to recognize command pattern. Use actions like: spent, transfer, received.
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end items-center gap-3 mt-1">
          <button 
            onClick={onClose}
            className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!parsed.isValid}
            className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <div className="flex items-center justify-center shrink-0">
              <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <span>Confirm & Log</span>
          </button>
        </div>
      </div>
    </div>
  );
}
