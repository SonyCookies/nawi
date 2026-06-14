"use client";

import { useState, useEffect } from "react";
import { 
  ChatBubbleOvalLeftIcon, 
  ArrowsRightLeftIcon, 
  ArrowDownIcon, 
  ArrowUpIcon,
  PlusIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import QuickChatModal from "./QuickChatModal";
import TransferModal from "./TransferModal";
import IncomeModal from "./IncomeModal";
import ExpenseModal from "./ExpenseModal";

export default function FAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"quick_chat" | "transfer" | "income" | "expense" | null>(null);

  useEffect(() => {
    const handleOpenModal = (e: Event) => {
      const customEvent = e as CustomEvent<"quick_chat" | "transfer" | "income" | "expense">;
      setActiveModal(customEvent.detail);
    };
    const handleOpenMenu = () => {
      setIsOpen(true);
    };
    window.addEventListener("open_fab_modal", handleOpenModal as EventListener);
    window.addEventListener("open_fab_menu", handleOpenMenu);
    return () => {
      window.removeEventListener("open_fab_modal", handleOpenModal as EventListener);
      window.removeEventListener("open_fab_menu", handleOpenMenu);
    };
  }, []);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const handleActionClick = (modal: "quick_chat" | "transfer" | "income" | "expense") => {
    setActiveModal(modal);
    setIsOpen(false);
  };

  return (
    <>
      {/* Background Dimming Overlay */}
      {isOpen && (
        <div 
          onClick={closeMenu}
          className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[2px] transition-all duration-300 animate-fadeIn"
        />
      )}

      {/* Floating Action Menu Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 select-none">
        
        {/* Actions Menu Card */}
        {isOpen && (
          <div 
            className="w-[340px] bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[28px] p-4 flex flex-col gap-1.5 animate-fadeInSimpleScale origin-bottom-right mb-2"
          >
            {/* Quick Chat */}
            <div 
              onClick={() => handleActionClick("quick_chat")}
              className="flex items-center gap-4 p-2.5 rounded-2xl cursor-pointer hover:bg-gray-100/50 active:bg-gray-100 transition-all duration-150 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#e6ebe7]/60 flex items-center justify-center shrink-0">
                <ChatBubbleOvalLeftIcon className="w-6 h-6 text-[#d97706] group-hover:scale-105 transition-transform duration-200" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-900 font-bold text-[16px] leading-tight">Quick chat</span>
                <span className="text-gray-500 text-xs mt-0.5 leading-snug">Enter a quick transaction.</span>
              </div>
            </div>

            <div className="border-t border-gray-100/80 my-0.5" />

            {/* Transfer */}
            <div 
              onClick={() => handleActionClick("transfer")}
              className="flex items-center gap-4 p-2.5 rounded-2xl cursor-pointer hover:bg-gray-100/50 active:bg-gray-100 transition-all duration-150 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#e6ebe7]/60 flex items-center justify-center shrink-0">
                <ArrowsRightLeftIcon className="w-6 h-6 text-[#047857] group-hover:scale-105 transition-transform duration-200" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-900 font-bold text-[16px] leading-tight">Transfer</span>
                <span className="text-gray-500 text-xs mt-0.5 leading-snug">Move money between accounts.</span>
              </div>
            </div>

            <div className="border-t border-gray-100/80 my-0.5" />

            {/* Income */}
            <div 
              onClick={() => handleActionClick("income")}
              className="flex items-center gap-4 p-2.5 rounded-2xl cursor-pointer hover:bg-gray-100/50 active:bg-gray-100 transition-all duration-150 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#e6ebe7]/60 flex items-center justify-center shrink-0">
                <ArrowDownIcon className="w-6 h-6 text-[#047857] group-hover:scale-105 transition-transform duration-200" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-900 font-bold text-[16px] leading-tight">Income</span>
                <span className="text-gray-500 text-xs mt-0.5 leading-snug">Record new money coming in.</span>
              </div>
            </div>

            <div className="border-t border-gray-100/80 my-0.5" />

            {/* Expense */}
            <div 
              onClick={() => handleActionClick("expense")}
              className="flex items-center gap-4 p-2.5 rounded-2xl cursor-pointer hover:bg-gray-100/50 active:bg-gray-100 transition-all duration-150 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#e6ebe7]/60 flex items-center justify-center shrink-0">
                <ArrowUpIcon className="w-6 h-6 text-[#b91c1c] group-hover:scale-105 transition-transform duration-200" strokeWidth={2} />
              </div>
              <div className="flex flex-col">
                <span className="text-gray-900 font-bold text-[16px] leading-tight">Expense</span>
                <span className="text-gray-500 text-xs mt-0.5 leading-snug">Log spending from a wallet or card.</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Floating Action Button */}
        <button
          onClick={toggleMenu}
          className={`w-16 h-16 rounded-[26px] flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer active:scale-95 ${
            isOpen 
              ? "bg-gradient-to-br from-[#cbd3db] to-[#a1aab3] hover:brightness-95 border border-white/20 text-white shadow-gray-400/20" 
              : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-purple-600/30 hover:shadow-xl hover:opacity-95"
          }`}
        >
          {isOpen ? (
            <XMarkIcon className="w-8 h-8 text-white stroke-2 animate-rotateIn" strokeWidth={2.5} />
          ) : (
            <PlusIcon className="w-8 h-8 text-white stroke-2 animate-rotateOut" strokeWidth={2.5} />
          )}
        </button>
      </div>

      {/* Transaction Modals */}
      <QuickChatModal 
        isOpen={activeModal === "quick_chat"} 
        onClose={() => setActiveModal(null)} 
      />
      <TransferModal 
        isOpen={activeModal === "transfer"} 
        onClose={() => setActiveModal(null)} 
      />
      <IncomeModal 
        isOpen={activeModal === "income"} 
        onClose={() => setActiveModal(null)} 
      />
      <ExpenseModal 
        isOpen={activeModal === "expense"} 
        onClose={() => setActiveModal(null)} 
      />
    </>
  );
}
