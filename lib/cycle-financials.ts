import { prisma } from "@/lib/prisma";

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  amount: number;
}

export interface CycleTransactionSummary {
  id: string;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  name: string;
  amount: number;
  categoryName: string | null;
  occurredAt: Date;
}

export interface CycleFinancials {
  baseIncome: number;
  extraIncome: number;
  totalExpenses: number;
  totalSavings: number;
  amountLeft: number;
  transactions: CycleTransactionSummary[];
  topCategories: CategoryTotal[];
}

/**
 * Aggregates a cycle's actual income/expenses/savings from logged
 * transactions (not the planned targets from onboarding) into the numbers
 * the dashboard KPI and chart need. Uses plain numbers, not Decimal — this
 * is a display-only aggregation over a handful of rows, not something
 * written back to the database.
 */
export async function getCycleFinancials(cycleId: string): Promise<CycleFinancials> {
  const [incomeEntries, rawTransactions] = await Promise.all([
    prisma.cycleIncomeEntry.findMany({ where: { cycleId } }),
    prisma.cycleTransaction.findMany({
      where: { cycleId },
      include: { expenseCategory: true },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  const baseIncome = incomeEntries.reduce((sum, entry) => sum + entry.netAmount.toNumber(), 0);

  const transactions: CycleTransactionSummary[] = rawTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    name: tx.name,
    amount: tx.amount.toNumber(),
    categoryName: tx.expenseCategory?.name ?? null,
    occurredAt: tx.occurredAt,
  }));

  const sumByType = (type: CycleTransactionSummary["type"]) =>
    transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);

  const extraIncome = sumByType("INCOME");
  const totalExpenses = sumByType("EXPENSE");
  const totalSavings = sumByType("SAVINGS");
  const amountLeft = baseIncome + extraIncome - totalExpenses - totalSavings;

  const categoryTotals = new Map<string, CategoryTotal>();
  for (const tx of rawTransactions) {
    if (tx.type !== "EXPENSE" || !tx.expenseCategory) continue;
    const amount = tx.amount.toNumber();
    const existing = categoryTotals.get(tx.expenseCategory.id);
    if (existing) {
      existing.amount += amount;
    } else {
      categoryTotals.set(tx.expenseCategory.id, {
        categoryId: tx.expenseCategory.id,
        categoryName: tx.expenseCategory.name,
        amount,
      });
    }
  }

  const topCategories = Array.from(categoryTotals.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    baseIncome,
    extraIncome,
    totalExpenses,
    totalSavings,
    amountLeft,
    transactions,
    topCategories,
  };
}
