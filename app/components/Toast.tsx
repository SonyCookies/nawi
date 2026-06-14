"use client";

import { useState, useEffect, useRef } from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface ToastMessage {
  title: string;
  description: string;
  type: "success" | "error";
}

interface ToastProps {
  sidebarWidth?: number;
}

export default function Toast({ sidebarWidth = 0 }: ToastProps) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsLeaving(true);
    leaveTimerRef.current = setTimeout(() => {
      setToast(null);
      setIsLeaving(false);
    }, 300);
  };

  useEffect(() => {
    const handleShowToast = (e: Event) => {
      const customEvent = e as CustomEvent<ToastMessage>;

      // Clear any pending timers
      if (timerRef.current) clearTimeout(timerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);

      // Reset and show new toast
      setIsLeaving(false);
      setToast(customEvent.detail);

      timerRef.current = setTimeout(() => {
        dismiss();
      }, 3000);
    };

    window.addEventListener("show_toast", handleShowToast);
    return () => {
      window.removeEventListener("show_toast", handleShowToast);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!toast) return null;

  const isSuccess = toast.type === "success";

  // Center horizontally in the main content area (full viewport minus sidebar)
  const mainWidth = typeof window !== "undefined" ? window.innerWidth - sidebarWidth : 0;
  const centerX = sidebarWidth + mainWidth / 2;

  return (
    <div
      className="fixed top-8 z-[9999] pointer-events-none"
      style={{ left: `${centerX}px`, transform: "translateX(-50%)" }}
    >
      <div
        className={`pointer-events-auto flex flex-col items-center ${
          isLeaving ? "animate-fadeOutUp" : "animate-fadeInDown"
        }`}
      >
        {/* Top Tab */}
        <div className="relative bg-[#121212] px-5 py-2 flex items-center gap-2 rounded-t-[16px] z-10 shrink-0">
          {/* Left concave corner connection */}
          <div className="absolute bottom-0 right-full w-4 h-4 bg-transparent rounded-br-[12px] shadow-[6px_6px_0_0_#121212] pointer-events-none" />
          {/* Right concave corner connection */}
          <div className="absolute bottom-0 left-full w-4 h-4 bg-transparent rounded-bl-[12px] shadow-[-6px_6px_0_0_#121212] pointer-events-none" />

          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              isSuccess ? "bg-green-500/10" : "bg-red-500/10"
            }`}
          >
            {isSuccess ? (
              <CheckIcon className="w-3.5 h-3.5 text-green-500" strokeWidth={3} />
            ) : (
              <XMarkIcon className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
            )}
          </div>
          <span
            className={`text-[12px] tracking-wide uppercase ${
              isSuccess ? "text-green-500" : "text-red-500"
            }`}
          >
            {toast.title}
          </span>
        </div>

        {/* Bottom Body */}
        <div className="bg-[#121212] px-10 py-4 rounded-[24px] text-white font-bold text-[16px] shadow-2xl shadow-black/60 text-center shrink-0 min-w-[320px]">
          {toast.description}
        </div>
      </div>
    </div>
  );
}
