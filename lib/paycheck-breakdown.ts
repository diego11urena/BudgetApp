import type { CategoryTotal, CycleTransactionSummary } from "./cycle-financials";

export type SliceKind = "expense" | "savings" | "remaining" | "other";

export interface BreakdownSlice {
  /** categoryId for an expense category, "savings"/"remaining"/"other" for the fixed buckets — stable across renders, used for selection and as the recent-transactions map key. */
  key: string;
  label: string;
  amount: number;
  /** 0-100, of pieTotal. */
  percentage: number;
  kind: SliceKind;
  /** CSS custom property name (e.g. "--chart-cat-3") this slice fills with — see app/globals.css. */
  colorVar: string;
  /** Only set on an "other" slice — the individual expense-category slices folded into it, for the drill-down when Other is selected. */
  members?: BreakdownSlice[];
}

export interface PaycheckBreakdown {
  pieTotal: number;
  /** Every individual slice, ungrouped — for the legend, nothing hidden. */
  legendSlices: BreakdownSlice[];
  /** Same underlying data, but small/excess expense categories fold into one "Other" slice — for the chart only. */
  chartSlices: BreakdownSlice[];
}

const DEFAULT_THRESHOLD_PERCENT = 5;
/** Matches the number of fixed categorical chart colors (--chart-cat-1..6) — beyond this, even an above-threshold category folds into "Other" so the chart never has to cycle/reuse a color. */
const MAX_CHART_CATEGORY_SLICES = 6;
const CATEGORY_COLOR_COUNT = 6;

/**
 * Deterministic hash -> preferred palette index, so a category's chart
 * color is anchored to its own identity (categoryId), not to amounts —
 * "color follows the entity, never its rank."
 */
function preferredColorIndex(categoryId: string): number {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return hash % CATEGORY_COLOR_COUNT;
}

/**
 * Assigns each category its hash-preferred color, resolving collisions by
 * probing to the next free slot — categories are processed in a fixed
 * (categoryId-sorted) order so the resolution itself is deterministic.
 * Guarantees every category gets a *distinct* color whenever there are no
 * more categories than the palette has slots (the common case); beyond
 * that, reuse becomes unavoidable and is resolved the same deterministic
 * way. A pure hash alone can't make this guarantee — with 6 categories in
 * 6 slots, an unresolved collision is more likely than not.
 */
function assignCategoryColorIndexes(categoryIds: string[]): Map<string, number> {
  const used = new Set<number>();
  const assignment = new Map<string, number>();
  for (const categoryId of [...categoryIds].sort()) {
    let index = preferredColorIndex(categoryId);
    for (let attempts = 0; used.has(index) && attempts < CATEGORY_COLOR_COUNT; attempts++) {
      index = (index + 1) % CATEGORY_COLOR_COUNT;
    }
    used.add(index);
    assignment.set(categoryId, index);
  }
  return assignment;
}

/**
 * Computes the Paycheck Breakdown pie: every spending category, a Savings
 * slice, and a Remaining slice, all as a share of the quincena's income —
 * except when spending+savings exceeds income (overspent), in which case
 * the pie's total is the spent+saved amount instead (so slices always sum
 * to exactly 100% and Remaining is never negative).
 */
export function computeBreakdown(
  financials: {
    baseIncome: number;
    extraIncome: number;
    totalExpenses: number;
    totalSavings: number;
    categoryTotals: CategoryTotal[];
  },
  thresholdPercent: number = DEFAULT_THRESHOLD_PERCENT,
): PaycheckBreakdown {
  const income = financials.baseIncome + financials.extraIncome;
  const spentAndSaved = financials.totalExpenses + financials.totalSavings;
  const pieTotal = Math.max(income, spentAndSaved);

  if (pieTotal <= 0) {
    return { pieTotal: 0, legendSlices: [], chartSlices: [] };
  }

  const remaining = Math.max(pieTotal - spentAndSaved, 0);

  const colorIndexes = assignCategoryColorIndexes(financials.categoryTotals.map((c) => c.categoryId));
  const categorySlices: BreakdownSlice[] = financials.categoryTotals.map((c) => ({
    key: c.categoryId,
    label: c.categoryName,
    amount: c.amount,
    percentage: (c.amount / pieTotal) * 100,
    kind: "expense",
    colorVar: `--chart-cat-${(colorIndexes.get(c.categoryId) ?? 0) + 1}`,
  }));

  const savingsSlice: BreakdownSlice | null =
    financials.totalSavings > 0
      ? {
          key: "savings",
          label: "Savings",
          amount: financials.totalSavings,
          percentage: (financials.totalSavings / pieTotal) * 100,
          kind: "savings",
          colorVar: "--chart-savings",
        }
      : null;

  const remainingSlice: BreakdownSlice | null =
    remaining > 0
      ? {
          key: "remaining",
          label: "Remaining",
          amount: remaining,
          percentage: (remaining / pieTotal) * 100,
          kind: "remaining",
          colorVar: "--chart-remaining",
        }
      : null;

  const legendSlices = [
    ...categorySlices,
    ...(savingsSlice ? [savingsSlice] : []),
    ...(remainingSlice ? [remainingSlice] : []),
  ].sort((a, b) => b.amount - a.amount);

  // Chart-only grouping: fold sub-threshold categories, and (if there are
  // still more than the palette can give a distinct color to) the smallest
  // excess too, into one "Other" slice.
  const sortedCategories = [...categorySlices].sort((a, b) => b.amount - a.amount);
  const keptCategories: BreakdownSlice[] = [];
  const foldedCategories: BreakdownSlice[] = [];
  sortedCategories.forEach((slice, i) => {
    if (slice.percentage < thresholdPercent || i >= MAX_CHART_CATEGORY_SLICES) {
      foldedCategories.push(slice);
    } else {
      keptCategories.push(slice);
    }
  });

  const otherSlice: BreakdownSlice | null =
    foldedCategories.length > 0
      ? {
          key: "other",
          label: "Other",
          amount: foldedCategories.reduce((sum, s) => sum + s.amount, 0),
          percentage: foldedCategories.reduce((sum, s) => sum + s.percentage, 0),
          kind: "other",
          colorVar: "--chart-other",
          members: foldedCategories.sort((a, b) => b.amount - a.amount),
        }
      : null;

  const chartSlices = [
    ...keptCategories,
    ...(savingsSlice ? [savingsSlice] : []),
    ...(remainingSlice ? [remainingSlice] : []),
    ...(otherSlice ? [otherSlice] : []),
  ].sort((a, b) => b.amount - a.amount);

  return { pieTotal, legendSlices, chartSlices };
}

/**
 * Buckets each transaction under its slice's key (an expense category's
 * id, or "savings"), capped at maxPerSlice — the "2-3 most recent
 * transactions" preview in the breakdown's detail panel. Relies on
 * `transactions` already being sorted newest-first (see getCycleFinancials),
 * so simply taking the first N per bucket gives the most recent N. Income
 * has no slice (Remaining/Other aren't real transaction buckets either).
 */
export function groupRecentTransactionsBySlice(
  transactions: CycleTransactionSummary[],
  categoryTotals: CategoryTotal[],
  maxPerSlice = 3,
): Record<string, CycleTransactionSummary[]> {
  const nameToId = new Map(categoryTotals.map((c) => [c.categoryName, c.categoryId]));
  const result: Record<string, CycleTransactionSummary[]> = {};

  for (const tx of transactions) {
    let key: string | null = null;
    if (tx.type === "EXPENSE" && tx.categoryName) {
      key = nameToId.get(tx.categoryName) ?? null;
    } else if (tx.type === "SAVINGS") {
      key = "savings";
    }
    if (!key) continue;

    if (!result[key]) result[key] = [];
    if (result[key].length < maxPerSlice) result[key].push(tx);
  }

  return result;
}
