import { prisma } from "@/lib/prisma";

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  amount: number;
}

/**
 * Sums only the categories that are actually fixed-expense targets this
 * cycle — "Fixed budget used" must reflect rent/subscriptions/etc. against
 * their own targets, not every expense category (groceries, an
 * uncategorized import) lumped in with them just because they're all
 * EXPENSE type.
 */
export function sumFixedTargetSpend(
  categoryTotals: CategoryTotal[],
  fixedTargetCategoryIds: string[],
): number {
  const targetIds = new Set(fixedTargetCategoryIds);
  return categoryTotals
    .filter((c) => targetIds.has(c.categoryId))
    .reduce((sum, c) => sum + c.amount, 0);
}

export interface CycleTransactionSummary {
  id: string;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  name: string;
  amount: number;
  categoryName: string | null;
  occurredAt: Date;
  /** Whether this row was auto-imported from Gmail rather than logged by hand. */
  isImported: boolean;
  /** How the transaction arrived — never a substitute for categoryName or paymentMethod, just the "📧 Gmail" display tag. */
  importSource: "MANUAL" | "GMAIL";
  /** What it was paid or received with — null for SAVINGS (no payment-method concept) or when never set. */
  paymentMethod: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY" | "ACH" | null;
  /** What the money was for, beyond name/merchant — mainly Yappy's own optional "Mensaje" note. Null for everything else. */
  description: string | null;
  /** Only set by callers building an all-time (cross-cycle) view. */
  cycleLabel?: string;
  /**
   * Only set by callers building an all-time (cross-cycle) view — whether
   * this row belongs to a still-open cycle. Undefined (the single-cycle
   * views, e.g. Home's "Recent transactions") always means editable: every
   * row there is already scoped to the current cycle.
   */
  isEditable?: boolean;
}

export interface CycleFinancials {
  baseIncome: number;
  extraIncome: number;
  totalExpenses: number;
  totalSavings: number;
  amountLeft: number;
  transactions: CycleTransactionSummary[];
  /** All EXPENSE categories with any transaction this cycle, full list, sorted desc. */
  categoryTotals: CategoryTotal[];
  /** categoryTotals.slice(0, 5) — for the Home dashboard's chart. */
  topCategories: CategoryTotal[];
}

interface DecimalLike {
  toNumber(): number;
}

interface IncomeEntryLike {
  netAmount: DecimalLike;
}

interface TransactionLike {
  id: string;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  name: string;
  amount: DecimalLike;
  occurredAt: Date;
  expenseCategory: { id: string; name: string } | null;
  sourceMessageId?: string | null;
  importSource?: "MANUAL" | "GMAIL";
  paymentMethod?: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY" | "ACH" | null;
  description?: string | null;
}

/**
 * Maps one raw transaction row into the shared display shape. `extra` is
 * for cross-cycle (all-time) callers like the Transactions tab, which know
 * a row's cycle label and whether that cycle is still editable — the
 * single-cycle callers (Home, History) leave both undefined.
 */
export function toCycleTransactionSummary(
  tx: TransactionLike,
  extra?: { cycleLabel?: string; isEditable?: boolean },
): CycleTransactionSummary {
  return {
    id: tx.id,
    type: tx.type,
    name: tx.name,
    amount: tx.amount.toNumber(),
    categoryName: tx.expenseCategory?.name ?? null,
    occurredAt: tx.occurredAt,
    isImported: (tx.sourceMessageId ?? null) !== null,
    importSource: tx.importSource ?? "MANUAL",
    paymentMethod: tx.paymentMethod ?? null,
    description: tx.description ?? null,
    ...extra,
  };
}

/**
 * Pure aggregation over already-fetched rows — lets History reuse the same
 * math on data getRecentCycles already pulled, without a query per cycle.
 * Uses plain numbers, not Decimal: this is a display-only aggregation over
 * a handful of rows, not something written back to the database.
 */
export function summarizeCycleFinancials(
  incomeEntries: IncomeEntryLike[],
  rawTransactions: TransactionLike[],
): CycleFinancials {
  const baseIncome = incomeEntries.reduce((sum, entry) => sum + entry.netAmount.toNumber(), 0);

  const transactions: CycleTransactionSummary[] = rawTransactions.map((tx) =>
    toCycleTransactionSummary(tx),
  );

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

  const sortedCategoryTotals = Array.from(categoryTotals.values()).sort(
    (a, b) => b.amount - a.amount,
  );
  const topCategories = sortedCategoryTotals.slice(0, 5);

  return {
    baseIncome,
    extraIncome,
    totalExpenses,
    totalSavings,
    amountLeft,
    transactions,
    categoryTotals: sortedCategoryTotals,
    topCategories,
  };
}

/** Fetches a cycle's income entries and transactions, then aggregates them. */
export async function getCycleFinancials(cycleId: string): Promise<CycleFinancials> {
  const [incomeEntries, rawTransactions] = await Promise.all([
    prisma.cycleIncomeEntry.findMany({ where: { cycleId } }),
    prisma.cycleTransaction.findMany({
      where: { cycleId },
      include: { expenseCategory: true },
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return summarizeCycleFinancials(incomeEntries, rawTransactions);
}
