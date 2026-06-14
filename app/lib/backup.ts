import { db, type Account, type Transaction, type Category, type ScheduledItem, type Debt } from "./db";

export interface BackupData {
  version: number;
  timestamp: string;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  scheduledItems: ScheduledItem[];
  debts?: Debt[];
}

/**
 * Exports all database tables to a formatted JSON string.
 */
export async function exportDatabaseToJson(): Promise<string> {
  const accounts = await db.accounts.toArray();
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const scheduledItems = await db.scheduledItems.toArray();
  const debts = await db.debts.toArray();

  const backup: BackupData = {
    version: 1,
    timestamp: new Date().toISOString(),
    accounts,
    transactions,
    categories,
    scheduledItems,
    debts
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Validates and imports the database backup JSON, overwriting all local tables.
 * Returns true if successful.
 */
export async function importDatabaseFromJson(jsonString: string): Promise<boolean> {
  const backup: BackupData = JSON.parse(jsonString);

  if (!backup || typeof backup !== "object") {
    throw new Error("Invalid backup format: root element is not an object");
  }
  if (!Array.isArray(backup.accounts)) {
    throw new Error("Invalid backup format: missing accounts array");
  }
  if (!Array.isArray(backup.transactions)) {
    throw new Error("Invalid backup format: missing transactions array");
  }
  if (!Array.isArray(backup.categories)) {
    throw new Error("Invalid backup format: missing categories array");
  }
  if (!Array.isArray(backup.scheduledItems)) {
    throw new Error("Invalid backup format: missing scheduledItems array");
  }

  // Parse and restore dates correctly
  const parsedAccounts: Account[] = backup.accounts.map(acc => ({
    ...acc,
    createdAt: acc.createdAt ? new Date(acc.createdAt) : new Date(),
    lastInterestCreditedDate: acc.lastInterestCreditedDate ? new Date(acc.lastInterestCreditedDate) : undefined,
  }));

  const parsedTransactions: Transaction[] = backup.transactions.map(tx => ({
    ...tx,
    date: tx.date ? new Date(tx.date) : new Date()
  }));

  const parsedCategories: Category[] = backup.categories.map(cat => ({
    ...cat
  }));

  const parsedScheduledItems: ScheduledItem[] = backup.scheduledItems.map(item => ({
    ...item,
    nextDueDate: item.nextDueDate ? new Date(item.nextDueDate) : undefined,
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date()
  }));

  const parsedDebts: Debt[] = (backup.debts || []).map(d => ({
    ...d,
    createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
    dueDate: d.dueDate ? new Date(d.dueDate) : undefined,
    history: (d.history || []).map((h: any) => ({
      ...h,
      date: h.date ? new Date(h.date) : new Date()
    }))
  }));

  // Perform atomic table clear and restoration within a transaction
  await db.transaction("rw", [db.accounts, db.transactions, db.categories, db.scheduledItems, db.debts], async () => {
    // Clear current tables
    await db.accounts.clear();
    await db.transactions.clear();
    await db.categories.clear();
    await db.scheduledItems.clear();
    await db.debts.clear();

    // Re-populate tables using bulkPut to preserve ids
    if (parsedAccounts.length > 0) await db.accounts.bulkPut(parsedAccounts);
    if (parsedTransactions.length > 0) await db.transactions.bulkPut(parsedTransactions);
    if (parsedCategories.length > 0) await db.categories.bulkPut(parsedCategories);
    if (parsedScheduledItems.length > 0) await db.scheduledItems.bulkPut(parsedScheduledItems);
    if (parsedDebts.length > 0) await db.debts.bulkPut(parsedDebts);
  });

  return true;
}
