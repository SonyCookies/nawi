import Dexie, { type Table } from "dexie";

export interface Account {
  id?: number;
  name: string;
  type: string;
  balance: number;
  currency: string;
  includeInTotals: boolean;
  bank?: string;
  creditLimit?: number;
  sortOrder?: number;
  createdAt: Date;
  earnsInterest?: boolean;
  interestRate?: number;
  taxRate?: number;
  lastInterestCreditedDate?: Date;
  paymentDueDay?: number; // Day of month (1-31) the credit card/paylater payment is due
  installmentTermMonths?: number; // Paylater installment term (e.g. 3, 6, 12 months)
  customInstallmentPayments?: number[]; // Custom amount for each month
}

export interface Transaction {
  id?: number;
  type: "transfer" | "income" | "expense";
  amount: number;
  description: string;
  fromAccountId?: number;
  toAccountId?: number;
  date: Date;
  fromAccountName?: string;
  toAccountName?: string;
  category?: string;
  transferFee?: number;
  treatAsExpense?: boolean;
  netWorth?: number;
  fromAccountBalance?: number;
  toAccountBalance?: number;
}

export interface Category {
  id?: number;
  name: string;
  sortOrder?: number;
  budget?: number; // Budget limit
  budgetPeriod?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'; // Budget period
  type?: 'expense' | 'income';
  icon?: string;
}

export interface ScheduledItem {
  id?: number;
  type: "expense" | "income";
  description: string;
  amount: number;
  accountId?: number;
  accountName?: string;
  interval: "monthly" | "weekly" | "yearly" | "one-time";
  nextDueDate?: Date;
  category?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface DebtLog {
  type: "creation" | "payment" | "increase";
  amount: number;
  date: Date;
  note?: string;
  category?: string;
  accountId?: number;
  accountName?: string;
}

export interface Debt {
  id?: number;
  personName: string;
  amount: number;
  paidAmount: number;
  description?: string;
  status: "open" | "paid" | "partially-paid";
  createdAt: Date;
  dueDate?: Date;
  history?: DebtLog[];
  sortOrder?: number;
  type?: "lend" | "borrow";
}

class NawiDatabase extends Dexie {
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  scheduledItems!: Table<ScheduledItem>;
  debts!: Table<Debt>;

  constructor() {
    super("NawiDatabase");
    this.version(1).stores({
      accounts: "++id, name, type, currency",
      transactions: "++id, type, fromAccountId, toAccountId, date"
    });
    this.version(2).stores({
      accounts: "++id, name, type, currency",
      transactions: "++id, type, fromAccountId, toAccountId, date",
      categories: "++id, name"
    });
    this.version(3).stores({
      accounts: "++id, name, type, currency",
      transactions: "++id, type, fromAccountId, toAccountId, date",
      categories: "++id, name",
      scheduledItems: "++id, type, nextDueDate, accountId, isActive"
    });
    this.version(4).stores({
      accounts: "++id, name, type, currency",
      transactions: "++id, type, fromAccountId, toAccountId, date",
      categories: "++id, name, type",
      scheduledItems: "++id, type, nextDueDate, accountId, isActive"
    });
    this.version(5).stores({
      accounts: "++id, name, type, currency",
      transactions: "++id, type, fromAccountId, toAccountId, date",
      categories: "++id, name, type",
      scheduledItems: "++id, type, nextDueDate, accountId, isActive",
      debts: "++id, personName, status, createdAt"
    });
  }
}

export const db = new NawiDatabase();
