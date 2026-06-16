"use client";

import { createPortal } from "react-dom";
import {
  XMarkIcon,
  PlusIcon,
  BanknotesIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { type Debt, type DebtLog } from "../lib/db";

interface DebtDetailModalProps {
  debt: Debt | null;
  isOpen: boolean;
  onClose: () => void;
  onIncreaseClick: () => void;
  onRecordClick: () => void;
}

function formatCurrency(amount: number, currency = "PHP") {
  const sym = currency === "PHP" ? "₱" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  return `${sym}${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function DebtDetailModal({
  debt,
  isOpen,
  onClose,
  onIncreaseClick,
  onRecordClick,
}: DebtDetailModalProps) {
  if (!isOpen || !debt) return null;

  const remaining = debt.amount - debt.paidAmount;
  const progressPct = debt.amount > 0 ? Math.round((debt.paidAmount / debt.amount) * 100) : 0;

  // Build temporary log list if history is empty
  const historyLogs: DebtLog[] = debt.history && debt.history.length > 0
    ? [...debt.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [
        {
          type: "creation",
          amount: debt.amount,
          date: debt.createdAt,
          note: debt.description || "Initial balance created",
        },
      ];

  const getLogTypeBadge = (type: DebtLog["type"]) => {
    switch (type) {
      case "creation":
        return "bg-purple-50 text-purple-700 border-purple-100";
      case "payment":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "increase":
        return "bg-amber-50 text-amber-700 border-amber-100";
    }
  };

  const getLogTypeLabel = (type: DebtLog["type"]) => {
    switch (type) {
      case "creation": return "Borrowed";
      case "payment": return "Paid";
      case "increase": return "Added Debt";
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/35 backdrop-blur-[6px] transition-all duration-300 animate-fadeIn">
      {/* Modal Card */}
      <div
        className="w-full max-w-[550px] bg-white/85 backdrop-blur-xl border border-white/50 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] rounded-[28px] p-6 flex flex-col gap-5 relative max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start shrink-0">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-2xl font-bold text-gray-900 leading-none">{debt.personName}</h2>
            <p className="text-sm text-gray-400">Debt details and payment timeline.</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-gray-100/80 flex items-center justify-center border border-gray-100 shadow-sm transition-all cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" strokeWidth={2.5} />
          </button>
        </div>

        {/* Financial Stat Card */}
        <div className="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-100/50 rounded-2xl p-4 flex justify-between items-center shrink-0">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-purple-500 font-semibold mb-0.5">
              Remaining Balance Owed
            </div>
            <div className="text-2xl font-black text-gray-955">
              {formatCurrency(remaining)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
              Total Initial Borrowed
            </div>
            <div className="text-base font-bold text-gray-800">
              {formatCurrency(debt.amount)}
            </div>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="flex flex-col gap-1.5 bg-gray-50/50 border border-gray-100/80 rounded-xl p-3 shadow-sm shrink-0">
          <div className="flex justify-between text-xs font-semibold text-gray-500">
            <span>Repayment progress</span>
            <span className="text-purple-700">{progressPct}% ({formatCurrency(debt.paidAmount)} paid)</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Action Options */}
        {debt.status !== "paid" && (
          <div className="flex gap-3 shrink-0">
            <button
              onClick={onIncreaseClick}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-700 font-bold text-sm transition-all cursor-pointer shadow-sm"
            >
              <PlusIcon className="w-4 h-4 text-purple-600 animate-pulse" strokeWidth={2.5} />
              <span>Add borrowed amount</span>
            </button>
            <button
              onClick={onRecordClick}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
            >
              <BanknotesIcon className="w-4 h-4" strokeWidth={2} />
              <span>Record payment</span>
            </button>
          </div>
        )}

        {/* History Timeline */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold shrink-0">
            Activity History
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 [-webkit-scrollbar]:w-1.5 [scrollbar-width:thin]">
            {historyLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start justify-between p-3.5 bg-gray-50/70 border border-gray-100/50 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="flex gap-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border shrink-0 h-fit ${getLogTypeBadge(log.type)}`}>
                    {getLogTypeLabel(log.type)}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-semibold text-gray-800">
                      {log.note || (log.type === "payment" ? "Payment made" : "Adjusted amount")}
                    </div>
                    {log.accountName && (
                      <div className="text-[11px] text-gray-400 font-medium">
                        Paid from {log.accountName} {log.category ? `• Category: ${log.category}` : ""}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-gray-300" />
                      {new Date(log.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold ${log.type === "payment" ? "text-emerald-600" : "text-gray-800"}`}>
                    {log.type === "payment" ? "+" : ""}{formatCurrency(log.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 mt-1 shrink-0 pt-2 border-t border-gray-50">
          <button
            onClick={() => {
              const receiptId = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
              const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Electronic Receipt - ${debt.personName}</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #f4f4f6;
      color: #1a1a1a;
      padding: 30px 15px;
      margin: 0;
      display: flex;
      justify-content: center;
    }
    .receipt {
      background: #ffffff;
      width: 100%;
      max-width: 450px;
      padding: 25px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      border-radius: 12px;
      border: 1px solid #e0e0e0;
    }
    .header {
      text-align: center;
      margin-bottom: 25px;
      border-bottom: 2px dashed #cccccc;
      padding-bottom: 15px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 2px;
      margin: 0 0 5px 0;
    }
    .subtitle {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      margin: 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .meta-label {
      color: #666;
    }
    .divider {
      border-top: 1px dashed #cccccc;
      margin: 15px 0;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .log-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      font-size: 12px;
      margin-bottom: 8px;
    }
    .log-note {
      font-weight: bold;
    }
    .log-date {
      font-size: 10px;
      color: #888;
      margin-top: 2px;
    }
    .totals {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px dashed #cccccc;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      margin-bottom: 6px;
    }
    .final-total {
      font-size: 18px;
      font-weight: bold;
      border-top: 1px solid #1a1a1a;
      padding-top: 8px;
      margin-top: 8px;
    }
    .status-stamp {
      text-align: center;
      margin-top: 30px;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 3px;
      text-transform: uppercase;
      padding: 8px;
      border: 3px double;
      transform: rotate(-3deg);
      border-radius: 4px;
      width: max-content;
      margin-left: auto;
      margin-right: auto;
    }
    .status-paid {
      color: #059669;
      border-color: #059669;
    }
    .status-open {
      color: #d97706;
      border-color: #d97706;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #888;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="logo">NAWI BUDGETS</h1>
      <p class="subtitle">Official Borrowing Statement</p>
    </div>
    
    <div class="meta-row">
      <span class="meta-label">Receipt ID:</span>
      <span>${receiptId}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Issued Date:</span>
      <span>${new Date().toLocaleString()}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Lender Name:</span>
      <strong>${debt.personName}</strong>
    </div>
    
    <div class="divider"></div>
    
    <div class="section-title">Timeline History</div>
    ${historyLogs.map(log => `
      <div class="log-item">
        <div>
          <div class="log-note">${log.type.toUpperCase()}: ${log.note || 'Adjustment'}</div>
          <div class="log-date">${new Date(log.date).toLocaleString()}</div>
        </div>
        <div style="font-weight: bold;">
          ${log.type === 'payment' ? '-' : ''}₱${log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
      </div>
    `).join('')}
    
    <div class="totals">
      <div class="total-row">
        <span>Initial Amount Borrowed:</span>
        <span>₱${debt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="total-row" style="color: #059669;">
        <span>Total Paid:</span>
        <span>₱${debt.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="total-row final-total">
        <span>Balance Remaining:</span>
        <span>₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
    
    <div class="status-stamp ${debt.status === 'paid' ? 'status-paid' : 'status-open'}">
      ${debt.status === 'paid' ? 'SETTLED' : 'OUTSTANDING'}
    </div>
    
    <div class="footer">
      Thank you for utilizing Nawi Budgets.<br>Keep tracking, keep saving.
    </div>
  </div>
</body>
</html>
              `;

              const blob = new Blob([htmlContent], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `debt-receipt-${debt.personName.toLowerCase().replace(/\s+/g, "-")}.html`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);

              window.dispatchEvent(new CustomEvent("show_toast", {
                detail: {
                  title: "Receipt Downloaded",
                  description: `Receipt saved for ${debt.personName}.`,
                  type: "success"
                }
              }));
            }}
            className="px-5 py-2.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold text-base transition-all cursor-pointer flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span>Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white border border-gray-100 text-gray-700 font-semibold text-base shadow-sm hover:bg-gray-50 transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
