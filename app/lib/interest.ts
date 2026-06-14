import { db } from "./db";

const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function applyDailyInterest(): Promise<number> {
  let interestCreditedCount = 0;

  try {
    // 1. Ensure the "Interest" category exists
    const categoryName = "Interest";
    const catExists = await db.categories.where("name").equalsIgnoreCase(categoryName).first();
    if (!catExists) {
      await db.categories.add({ name: categoryName });
    }

    // 2. Fetch all accounts earning daily interest
    const allAccounts = await db.accounts.toArray();
    const interestAccounts = allAccounts.filter(acc => acc.earnsInterest === true);

    const todayStart = getStartOfDay(new Date());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    for (const acc of interestAccounts) {
      if (!acc.id) continue;

      let startDate: Date;
      if (acc.lastInterestCreditedDate) {
        // Start the day after the last credited date
        startDate = getStartOfDay(acc.lastInterestCreditedDate);
        startDate.setDate(startDate.getDate() + 1);
      } else {
        // Start on the day the account was created
        startDate = getStartOfDay(acc.createdAt);
      }

      let d = new Date(startDate);
      let runningBalance = acc.balance;
      let lastAppliedDate = acc.lastInterestCreditedDate ? new Date(acc.lastInterestCreditedDate) : null;
      let updated = false;

      // Wrap the day-by-day updates in a transaction for safety
      await db.transaction("rw", [db.accounts, db.transactions], async () => {
        // Re-read account to prevent race conditions during transaction
        const freshAcc = await db.accounts.get(acc.id!);
        if (!freshAcc) return;

        runningBalance = freshAcc.balance;
        lastAppliedDate = freshAcc.lastInterestCreditedDate ? new Date(freshAcc.lastInterestCreditedDate) : null;

        while (getStartOfDay(d) <= yesterdayStart) {
          const rate = freshAcc.interestRate ?? 0;
          const tax = freshAcc.taxRate ?? 20;

          // (Running Balance * gross annual rate / 365) * (1 - tax / 100)
          const dailyRate = rate / 100 / 365;
          const grossInterest = runningBalance * dailyRate;
          const netInterest = grossInterest * (1 - tax / 100);

          // Round to 2 decimal places
          const roundedInterest = Math.round(netInterest * 100) / 100;

          // The interest is credited on the next day
          const creditDay = new Date(d.getTime() + 24 * 60 * 60 * 1000);
          creditDay.setHours(6, 0, 0, 0); // Credit at 6:00 AM local time

          if (roundedInterest >= 0.01) {
            runningBalance = Math.round((runningBalance + roundedInterest) * 100) / 100;

            // Save daily interest transaction
            await db.transactions.add({
              type: "income",
              amount: roundedInterest,
              description: `${freshAcc.name} Daily Interest`,
              date: creditDay,
              toAccountId: freshAcc.id,
              toAccountName: freshAcc.name,
              category: categoryName,
              toAccountBalance: runningBalance
            });

            interestCreditedCount++;
          }

          lastAppliedDate = new Date(d);
          updated = true;

          // Move to the next calendar day
          d.setDate(d.getDate() + 1);
        }

        if (updated) {
          // Sync all changes back to database for this account
          await db.accounts.update(freshAcc.id!, {
            balance: runningBalance,
            lastInterestCreditedDate: lastAppliedDate || undefined
          });
        }
      });
    }
  } catch (err) {
    console.error("Error applying daily interest:", err);
  }

  return interestCreditedCount;
}
