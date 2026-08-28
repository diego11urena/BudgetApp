import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/lib/payment-method";
import type { TransactionType } from "@/lib/transaction-type";

export interface RecentTransactionTemplate {
  type: TransactionType;
  name: string;
  categoryName: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
}

/**
 * The user's single most recent transaction, across every cycle (not just
 * the current one) -- powers the "log again" shortcut on Home (see the
 * fix-list's batch 11.2, "same as last time"). Deliberately not scoped to
 * the current cycle: right after a payday reset the new cycle has zero
 * transactions yet, which is exactly when repeating yesterday's coffee is
 * most useful. Only surfaces a categorized transaction -- QuickAddSheet
 * requires a category, and there's no sensible one to prefill for a
 * transaction that predates categories existing or was left uncategorized.
 */
export async function getMostRecentTransaction(userId: string): Promise<RecentTransactionTemplate | null> {
  const transaction = await prisma.cycleTransaction.findFirst({
    where: { cycle: { userId }, expenseCategoryId: { not: null } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    include: { expenseCategory: { select: { name: true } } },
  });
  if (!transaction || !transaction.expenseCategory) return null;

  return {
    type: transaction.type,
    name: transaction.name,
    categoryName: transaction.expenseCategory.name,
    amount: transaction.amount.toNumber(),
    paymentMethod: transaction.paymentMethod,
  };
}
