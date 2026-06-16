"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  XMarkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { db } from "../lib/db";

interface AddCollectibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddCollectibleModal({
  isOpen,
  onClose,
  onAdded,
}: AddCollectibleModalProps) {
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [hasDueDate, setHasDueDate] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setPersonName("");
    setAmount("");
    setDescription("");
    setDueDate("");
    setHasDueDate(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !amount) return;
    setLoading(true);
    try {
      const debtAmount = parseFloat(amount);
      const count = await db.debts.count();
      await db.debts.add({
        personName: personName.trim(),
        amount: debtAmount,
        paidAmount: 0,
        description: description.trim() || undefined,
        status: "open",
        createdAt: new Date(),
        dueDate: hasDueDate && dueDate ? new Date(dueDate + "T00:00:00") : undefined,
        sortOrder: count + 1,
        type: "lend",
        history: [
          {
            type: "creation",
            amount: debtAmount,
            date: new Date(),
            note: description.trim() || "Initial balance created",
          }
        ]
      });
      onAdded();
      handleClose();
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Collectible Added",
          description: `Collectible for ${personName.trim()} added successfully.`,
          type: "success"
        }
      }));
    } catch (error) {
      console.error("Error adding collectible:", error);
      window.dispatchEvent(new CustomEvent("show_toast", {
        detail: {
          title: "Error",
          description: "Failed to add collectible.",
          type: "error"
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
            <h2 className="text-2xl font-bold text-gray-900 leading-none">Add collectible</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Track an amount someone owes you.
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
          {/* Name Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Person's name</label>
            <input
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="e.g. Juan"
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Amount Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">Amount owed</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Description Field */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium tracking-wide text-gray-500">
              Description <span className="font-normal text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Borrowed cash for groceries"
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-950 font-medium placeholder-gray-400 focus:outline-none focus:border-purple-500/50 shadow-sm"
            />
          </div>

          {/* Due Date Field */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium tracking-wide text-gray-500">Due date</label>
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
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-base text-gray-955 font-medium focus:outline-none focus:border-purple-500/50 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span>{loading ? "Adding..." : "Add collectible"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
