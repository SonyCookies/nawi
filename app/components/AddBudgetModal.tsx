"use client";

import { useState } from "react";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";

export const AVAILABLE_ICONS = [
  // Food & Drink
  "🍔", "🍟", "🍕", "🥗", "☕", "🍜", "🍣", "🍰", "🍩", "🍎", "🍺", "🍷",
  // Transportation & Travel
  "🚗", "🚌", "✈️", "🚄", "🚲", "🚕", "⛽", "🚢", "🏨", "🗺️",
  // Shopping & Personal Care
  "🛒", "👕", "👟", "👜", "💄", "🕶️", "💍", "💈", "🧴", "🧼",
  // Entertainment & Leisure
  "🎬", "🎮", "⚽", "🏀", "🎸", "🎨", "🎵", "🎟️", "🍿", "🎳",
  // Health & Wellness
  "🏥", "💊", "🩺", "🦷", "🧗", "🧘", "🐾",
  // Education & Work
  "🎓", "📚", "💻", "💼", "📄", "✏️", "🏢", "📢",
  // Home & Utilities
  "🏠", "🏡", "⚡", "💧", "🌐", "📱", "📺", "🔧", "🛋️", "🗑️", "📦",
  // Borrowing & Hands
  "🫴", "🫳", "🤝", "🤲", "💸", "⏳",
  // Financial & Subscriptions
  "💰", "📈", "🏦", "💵", "🪙", "💳", "🧾", "🔄", "🛡️", "💎", "🏆", "🎁", "🎈"
];

interface AddBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddBudgetModal({ isOpen, onClose }: AddBudgetModalProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>("select");
  const [customName, setCustomName] = useState("");
  const [limit, setLimit] = useState("");
  const [period, setPeriod] = useState<"daily" | "weekly" | "biweekly" | "monthly" | "yearly">("monthly");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📦");
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Retrieve existing categories
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Filter categories that do NOT have a budget limit set yet and are expense type
  const availableCategories = categories.filter(
    c => (!c.type || c.type === "expense") && (c.budget === undefined || c.budget <= 0)
  );

  const handleSave = async () => {
    let catName = "";

    if (selectedCatId === "new") {
      if (!customName.trim()) return;
      catName = customName.trim();
    } else if (selectedCatId !== "select") {
      catName = selectedCatId;
    } else {
      return; // Select category first
    }

    const cleanedVal = limit.replace(/[^\d.]/g, "");
    const parsedLimit = parseFloat(cleanedVal);
    if (isNaN(parsedLimit) || parsedLimit <= 0) return;

    try {
      // Check if a category with this name already exists in database (case-insensitive)
      const existing = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());

      if (existing) {
        await db.categories.update(existing.id!, {
          budget: parsedLimit,
          budgetPeriod: period,
          type: "expense",
          // Update icon if they created custom name matches existing one
          ...(selectedCatId === "new" ? { icon: newCategoryIcon } : {})
        });
      } else {
        // Create new category with budget and period
        await db.categories.add({
          name: catName,
          budget: parsedLimit,
          budgetPeriod: period,
          type: "expense",
          icon: newCategoryIcon,
          sortOrder: categories.length + 1
        });
      }

      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Budget Added", 
          description: `Budget for ${catName} configured successfully.`, 
          type: "success" 
        } 
      }));

      // Reset fields
      setSelectedCatId("select");
      setCustomName("");
      setLimit("");
      setPeriod("monthly");
      setNewCategoryIcon("📦");
      setShowIconPicker(false);
      onClose();
    } catch (err) {
      console.error("Error saving budget:", err);
      window.dispatchEvent(new CustomEvent("show_toast", { 
        detail: { 
          title: "Error", 
          description: "Failed to save budget settings.", 
          type: "error" 
        } 
      }));
    }
  };

  const handleLimitChange = (val: string) => {
    if (val === "") {
      setLimit("");
      return;
    }

    let clean = val.replace(/[^\d.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    
    const integerPart = parts[0];
    const decimalPart = parts[1] !== undefined ? "." + parts[1] : "";
    
    if (integerPart) {
      const num = parseFloat(integerPart.replace(/,/g, ""));
      if (!isNaN(num)) {
        setLimit(num.toLocaleString("en-US") + decimalPart);
        return;
      }
    }
    setLimit(clean);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="w-full max-w-[500px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5 max-w-[90%]">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Add budget</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Define a spending limit and cycle for a specific category to help track your outlays.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4">
          
          {/* Category Dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Category</label>
            <div className="relative">
              <select 
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
              >
                <option value="select" disabled>Select a category...</option>
                {availableCategories.map((c) => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
                {/* Fallback for Transfer Fee if not in available list */}
                {!availableCategories.some(c => c.name === "Transfer Fee") && 
                 !categories.some(c => c.name === "Transfer Fee" && c.budget !== undefined && c.budget > 0) && (
                  <option value="Transfer Fee">Transfer Fee</option>
                )}
                <option value="new">+ Create new category...</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* New Custom Category Input with Icon Picker */}
          {selectedCatId === "new" && (
            <div className="flex flex-col gap-2 animate-fadeInSimple">
              <label className="text-sm font-medium tracking-wide text-gray-500">Category Name & Icon</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-2xl hover:border-purple-500/50 shadow-sm cursor-pointer shrink-0"
                  title="Choose icon"
                >
                  {newCategoryIcon}
                </button>
                <input 
                  type="text" 
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-955 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
                  placeholder="e.g. Travel"
                />
              </div>

              {/* Icon Picker Grid */}
              {showIconPicker && (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl max-h-[130px] overflow-y-auto flex flex-wrap gap-2 animate-fadeInSimple select-none">
                  {AVAILABLE_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setNewCategoryIcon(emoji);
                        setShowIconPicker(false);
                      }}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer ${
                        newCategoryIcon === emoji 
                          ? "bg-purple-600 text-white scale-110 shadow-sm shadow-purple-600/20" 
                          : "bg-white hover:bg-gray-100 border border-gray-100"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Limit Input */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium tracking-wide text-gray-500">Budget Limit</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-gray-400 font-medium select-none">₱</span>
                <input 
                  type="text" 
                  value={limit}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-xl pl-8 pr-4 py-3 text-base text-gray-955 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Period Dropdown */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium tracking-wide text-gray-500">Period</label>
              <div className="relative">
                <select 
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-955 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
            </div>
          </div>
        </div>

        </div>

        {/* Actions */}
        <div className="flex justify-end items-center gap-3 mt-2">
          <button 
            onClick={onClose}
            className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={selectedCatId === "select" || (selectedCatId === "new" && !customName.trim()) || !limit}
            className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
          >
            <div className="flex items-center justify-center shrink-0">
              <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
            </div>
            <span>Save budget</span>
          </button>
        </div>
      </div>
    </div>
  );
}
