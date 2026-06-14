"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface DeleteTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  description: string;
}

export default function DeleteTransactionModal({
  isOpen,
  onClose,
  onConfirm,
  description,
}: DeleteTransactionModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div 
        className="w-full max-w-[480px] bg-white/75 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[24px] p-5 relative flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center border border-gray-100 shadow-sm transition-all duration-200 cursor-pointer"
        >
          <XMarkIcon className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start pr-8">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6" strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xl font-bold text-gray-950 leading-tight">Delete Transaction</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-gray-800">&quot;{description}&quot;</span>? This will permanently delete the transaction and <span className="font-bold text-red-600">reverse its effect</span> on your account balances.
            </p>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3">
          <button 
            onClick={onClose}
            className="flex items-center justify-center px-5 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold text-lg transition-all duration-200 border border-gray-100 shadow-sm cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold text-lg rounded-xl shadow-md shadow-red-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Delete & Reverse</span>
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
