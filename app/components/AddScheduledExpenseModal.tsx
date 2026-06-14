"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ScheduledItem } from "../lib/db";

interface AddScheduledExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  itemToEdit?: ScheduledItem | null;
}

const INTERVALS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
  { value: "one-time", label: "One-time" },
] as const;

export default function AddScheduledExpenseModal({ isOpen, onClose, onSaved, itemToEdit }: AddScheduledExpenseModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState<"monthly" | "weekly" | "yearly" | "one-time">("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [hasDueDate, setHasDueDate] = useState(true);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fetch expense categories
  const categories = useLiveQuery(() => db.categories.where("type").equals("expense").toArray()) || [];

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Sync state with itemToEdit or default values
  useEffect(() => {
    if (itemToEdit) {
      setDescription(itemToEdit.description);
      setAmount(itemToEdit.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setInterval(itemToEdit.interval);
      setNextDueDate(itemToEdit.nextDueDate ? new Date(itemToEdit.nextDueDate).toISOString().split("T")[0] : "");
      setHasDueDate(!!itemToEdit.nextDueDate);
      setCategory(itemToEdit.category || "");
    } else {
      setDescription("");
      setAmount("");
      setInterval("monthly");
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setNextDueDate(d.toISOString().split("T")[0]);
      setHasDueDate(true);
      if (categories.length > 0) {
        setCategory(categories[0].name);
      }
    }
  }, [itemToEdit, categories]);

  const handleAmountChange = (val: string) => {
    if (val === "") { setAmount(""); return; }
    let clean = val.replace(/[^\d.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) clean = parts[0] + "." + parts.slice(1).join("");
    const intPart = clean.split(".")[0];
    const decPart = clean.includes(".") ? "." + clean.split(".")[1] : "";
    if (intPart) {
      const num = parseFloat(intPart.replace(/,/g, ""));
      if (!isNaN(num)) { setAmount(num.toLocaleString("en-US") + decPart); return; }
    }
    setAmount(clean);
  };

  const handleSave = async () => {
    if (!description.trim() || !amount) return;
    setSaving(true);
    try {
      const parsedAmount = parseFloat(amount.replace(/,/g, "")) || 0;
      const dueDateVal = hasDueDate && nextDueDate ? new Date(nextDueDate + "T00:00:00") : undefined;
      const categoryVal = category.trim() || undefined;

      if (itemToEdit && itemToEdit.id) {
        await db.scheduledItems.update(itemToEdit.id, {
          description: description.trim(),
          amount: parsedAmount,
          interval,
          nextDueDate: dueDateVal,
          category: categoryVal,
        });
        window.dispatchEvent(new CustomEvent("show_toast", {
          detail: { title: "Scheduled Expense Saved", description: `${description.trim()} updated.`, type: "success" }
        }));
      } else {
        await db.scheduledItems.add({
          type: "expense",
          description: description.trim(),
          amount: parsedAmount,
          interval,
          nextDueDate: dueDateVal,
          category: categoryVal,
          isActive: true,
          createdAt: new Date(),
        });
        window.dispatchEvent(new CustomEvent("show_toast", {
          detail: { title: "Scheduled Expense Added", description: `${description.trim()} saved.`, type: "success" }
        }));
      }
      
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] animate-fadeIn select-none">
      <div
        className="w-full max-w-[480px] bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">
              {itemToEdit ? "Edit Scheduled Expense" : "Add Scheduled Expense"}
            </h2>
            <p className="text-sm text-gray-400">
              {itemToEdit ? "Modify recurring expense details." : "Track a recurring monthly or weekly expense bill."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-500">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Netflix, Globe postpaid, Electricity..."
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 font-medium placeholder-gray-300 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Amount + Interval */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-500">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">₱</span>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-gray-100 rounded-xl pl-7 pr-3 py-3 text-base text-gray-900 font-medium placeholder-gray-300 focus:outline-none focus:border-purple-500/50 shadow-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-500">Repeats</label>
              <div className="relative">
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as typeof interval)}
                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
                >
                  {INTERVALS.map((i) => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Next Due Date + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-500">Next Due Date</label>
                <label className="flex items-center gap-1 cursor-pointer select-none text-xs text-gray-400">
                  <input
                    type="checkbox"
                    checked={hasDueDate}
                    onChange={(e) => setHasDueDate(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span>Has due date</span>
                </label>
              </div>
              <input
                type="date"
                disabled={!hasDueDate}
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 font-medium focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-500">Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-900 font-medium appearance-none focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-1.5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white border border-gray-100 text-gray-700 font-semibold text-base shadow-sm hover:bg-gray-50 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !description.trim() || !amount}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-base rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {itemToEdit ? (
              <>
                <CheckIcon className="w-5 h-5" strokeWidth={2.5} />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <PlusIcon className="w-5 h-5" strokeWidth={2} />
                <span>Add expense</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
