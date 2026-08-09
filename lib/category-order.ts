import { prisma } from "@/lib/prisma";
import { IMPORT_CATEGORY_NAME } from "@/lib/gmail-sync";

export interface CategoryUsageInfo {
  name: string;
  /** Times used in the current cycle. */
  cycleCount: number;
  /** Most recent use across all cycles, or null if never used. */
  lastUsedAt: Date | null;
}

/**
 * Most-used-in-the-current-cycle first (by count), then categories used
 * before but not this cycle (by recency), then never-used categories
 * alphabetically. A single sort handles the first two tiers: any category
 * with cycleCount > 0 always outranks one with cycleCount === 0, and ties
 * fall back to recency — so "used this cycle" and "used before" don't need
 * separate sort passes, just separate final buckets ordered before/after.
 */
export function orderCategoriesByUsage(usage: CategoryUsageInfo[]): string[] {
  const everUsed = usage.filter((u) => u.lastUsedAt !== null);
  const neverUsed = usage.filter((u) => u.lastUsedAt === null);

  everUsed.sort((a, b) => {
    if (b.cycleCount !== a.cycleCount) return b.cycleCount - a.cycleCount;
    return b.lastUsedAt!.getTime() - a.lastUsedAt!.getTime();
  });
  neverUsed.sort((a, b) => a.name.localeCompare(b.name));

  return [...everUsed.map((u) => u.name), ...neverUsed.map((u) => u.name)];
}

/**
 * Category names for a user + type, ordered per orderCategoriesByUsage.
 * Usage counts are derived live from CycleTransaction (the same store
 * transactions already live in) rather than a separate denormalized
 * counter, so there's nothing to keep in sync when a transaction is
 * logged or deleted.
 */
export async function getOrderedCategoryNames(
  userId: string,
  cycleId: string,
  type: "EXPENSE" | "SAVINGS",
): Promise<string[]> {
  // Bank Import is a system-managed bucket for Gmail-imported transactions,
  // never a sensible thing to manually pick as a category for a new
  // transaction or budget target — excluded from suggestions entirely.
  const categories = (
    await prisma.expenseCategory.findMany({
      where: { userId, type },
      select: { id: true, name: true },
    })
  ).filter((c) => c.name !== IMPORT_CATEGORY_NAME);
  if (categories.length === 0) return [];

  const categoryIds = categories.map((c) => c.id);

  const [cycleCounts, lastUsed] = await Promise.all([
    prisma.cycleTransaction.groupBy({
      by: ["expenseCategoryId"],
      where: { cycleId, expenseCategoryId: { in: categoryIds } },
      _count: { _all: true },
    }),
    prisma.cycleTransaction.groupBy({
      by: ["expenseCategoryId"],
      where: { expenseCategoryId: { in: categoryIds }, cycle: { userId } },
      _max: { occurredAt: true },
    }),
  ]);

  const cycleCountByCategory = new Map(
    cycleCounts.map((row) => [row.expenseCategoryId, row._count._all]),
  );
  const lastUsedByCategory = new Map(
    lastUsed.map((row) => [row.expenseCategoryId, row._max.occurredAt]),
  );

  const usage: CategoryUsageInfo[] = categories.map((c) => ({
    name: c.name,
    cycleCount: cycleCountByCategory.get(c.id) ?? 0,
    lastUsedAt: lastUsedByCategory.get(c.id) ?? null,
  }));

  return orderCategoriesByUsage(usage);
}
