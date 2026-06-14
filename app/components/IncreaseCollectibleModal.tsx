"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { db, type Debt } from "../lib/db";

interface IncreaseCollectibleModalProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function IncreaseCollectibleModal({
  debt,
  isOpen,
  onClose,
  onUpdated,
}: IncreaseCollectibleModalProps) {
  const [amountToAdd, setAmountToAdd] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setAmountToAdd("");
    setNote("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debt || !amountToAdd) return;
    setLoading(true);

    try {
      const addVal = parseFloat(amountToAdd);
      const newAmount = debt.amount + addVal;

      const currentHistory = debt.history || [
        {
          type: "creation",
          amount: debt.amount,
          date: debt.createdAt,
          note: debt.description || "Initial balance created"
        }
      ];

      // Update debt amount and append increase log to history
      await db.debts.update(debt.id!, {
        amount: newAmount,
        status: debt.status === "paid" && addVal > 0 ? "partially-paid" : debt.status,
        history: [
          ...currentHistory,
          {
            type: "increase",
            amount: addVal,
            date: new Date(),
            note: note.trim() || "Owed amount increased",
          }
        ]
      });

      onUpdated();
      handleClose();
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Collectible Increased",
          description: `Added ₱${addVal.toLocaleString("en-US", { minimumFractionDigits: 2 })} to ${debt.personName}'s owed amount.`,
          type: "success"
        }
      }));
    } catch (error) {
      console.error("Error updating collectible:", error);
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Error",
          description: "Failed to increase owed amount.",
          type: "error"
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !debt) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div
        className="w-full max-w-[500px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 relative flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1.5 max-w-[90%]">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Add owed amount</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Increase the amount <span className="font-semibold text-gray-700">{debt.personName}</span> owes you.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Amount to Add Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Amount to add</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amountToAdd}
              onChange={(e) => setAmountToAdd(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Note Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">
              Note / Reason <span className="font-normal text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Borrowed extra cash for lunch"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end items-center gap-3 mt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-3 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center justify-center shrink-0">
                <CheckIcon className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <span>{loading ? "Saving..." : "Add amount"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
