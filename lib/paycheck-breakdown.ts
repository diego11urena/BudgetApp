import type { CycleTransactionSummary } from "./cycle-financials";

export type SliceKind = "expense" | "savings" | "remaining" | "other";
export type BreakdownScope = "full" | "spending";
export type BreakdownGroupBy = "category" | "paymentMethod";

/** A generic amount bucket to slice — either an expense category or a payment method, both reduced to the same {id, name, amount} shape so computeBreakdown doesn't need to know which. */
export interface GroupTotal {
  id: string;
  name: string;
  amount: number;
}

export interface BreakdownSlice {
  /** A category/payment-method's id, or "savings"/"remaining"/"other" for the fixed buckets — stable across renders, used for selection and as the recent-transactions map key. */
  key: string;
  label: string;
  amount: number;
  /** 0-100, of pieTotal. */
  percentage: number;
  kind: SliceKind;
  /** CSS custom property name (e.g. "--chart-cat-3") this slice fills with — see app/globals.css. */
  colorVar: string;
  /** Only set on an "other" slice — the individual slices folded into it, for the drill-down when Other is selected. */
  members?: BreakdownSlice[];
}

export interface PaycheckBreakdown {
  pieTotal: number;
  /** Every individual slice, ungrouped — for the legend, nothing hidden. */
  legendSlices: BreakdownSlice[];
  /** Same underlying data, but small/excess slices fold into one "Other" slice — for the chart only. */
  chartSlices: BreakdownSlice[];
}

const DEFAULT_THRESHOLD_PERCENT = 5;
/** Matches the number of fixed categorical chart colors (--chart-cat-1..8) — beyond this, even an above-threshold group folds into "Other" so the chart never has to cycle/reuse a color. */
const MAX_CHART_GROUP_SLICES = 6;
const CATEGORY_COLOR_COUNT = 8;

/** Payment methods are a small, fixed set — direct color assignment, no hashing/collision-resolution needed (unlike the unbounded set of user categories). */
const PAYMENT_METHOD_COLOR_VAR: Record<string, string> = {
  CASH: "--chart-cat-1",
  CREDIT_CARD: "--chart-cat-2",
  DEBIT_CARD: "--chart-cat-3",
  YAPPY: "--chart-cat-4",
  ACH: "--chart-cat-5",
  UNSPECIFIED: "--chart-other",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  YAPPY: "Yappy",
  ACH: "ACH",
  UNSPECIFIED: "Unspecified",
};

/**
 * Deterministic hash -> preferred palette index, so a category's chart
 * color is anchored to its own identity (categoryId), not to amounts —
 * "color follows the entity, never its rank."
 */
function preferredColorIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % CATEGORY_COLOR_COUNT;
}

/**
 * Assigns each category its hash-preferred color, resolving collisions by
 * probing to the next free slot. `visibleIds` — the categories that will
 * actually render as their own chart slice, i.e. survive the
 * threshold/MAX_CHART_GROUP_SLICES fold below — are assigned first
 * (id-sorted, for determinism), so they're guaranteed distinct colors
 * whenever there's room in the palette for them (true today:
 * MAX_CHART_GROUP_SLICES <= CATEGORY_COLOR_COUNT). A category that gets
 * folded into "Other" in the chart still needs *some* color for the
 * legend (which hides nothing), assigned afterward from whatever slots
 * remain — those can collide with each other, but never with a slice
 * that's actually visible in the pie, which is the only collision a user
 * can actually see.
 */
function assignCategoryColorIndexes(visibleIds: string[], allIds: string[]): Map<string, number> {
  const visibleSet = new Set(visibleIds);
  const orderedIds = [...visibleIds.sort(), ...allIds.filter((id) => !visibleSet.has(id)).sort()];

  const used = new Set<number>();
  const assignment = new Map<string, number>();
  for (const id of orderedIds) {
    let index = preferredColorIndex(id);
    for (let attempts = 0; used.has(index) && attempts < CATEGORY_COLOR_COUNT; attempts++) {
      index = (index + 1) % CATEGORY_COLOR_COUNT;
    }
    used.add(index);
    assignment.set(id, index);
  }
  return assignment;
}

function colorVarFor(id: string, groupBy: BreakdownGroupBy, colorIndexes: Map<string, number>): string {
  // Neither bucket is a real category/payment-method identity — route both
  // to the neutral "other" color rather than letting them consume (or
  // collide with) a real slot in either palette.
  if (id === "UNSPECIFIED" || id === "UNCATEGORIZED") return "--chart-other";
  if (groupBy === "paymentMethod") {
    return PAYMENT_METHOD_COLOR_VAR[id] ?? "--chart-other";
  }
  return `--chart-cat-${(colorIndexes.get(id) ?? 0) + 1}`;
}

/**
 * Sums a cycle's EXPENSE transactions by payment method — the "Payment
 * method" group-by axis, parallel to categoryTotals. A transaction with no
 * recorded payment method (pre-this-feature manual entries) still needs a
 * bucket so the pie always sums to exactly 100% — "Unspecified" is that
 * bucket, not a real PaymentMethod enum value.
 */
export function computePaymentMethodTotals(transactions: CycleTransactionSummary[]): GroupTotal[] {
  const totals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type !== "EXPENSE") continue;
    const key = tx.paymentMethod ?? "UNSPECIFIED";
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
  }
  return Array.from(totals.entries())
    .map(([id, amount]) => ({ id, name: PAYMENT_METHOD_LABEL[id] ?? id, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Appends a synthetic "Uncategorized" bucket sized as the residual between
 * totalExpenses and the sum of real category totals. categoryTotals (see
 * lib/cycle-financials.ts) deliberately excludes EXPENSE transactions with
 * no category — correct for "Top categories"/"Fixed budget used", but for
 * this pie it would otherwise mean that spending just vanishes from the
 * category-grouped legend/chart while still being subtracted from
 * Remaining, so slices would sum to less than 100%. Mirrors how
 * computePaymentMethodTotals buckets a null payment method as "Unspecified".
 */
export function withUncategorizedBucket(categoryTotals: GroupTotal[], totalExpenses: number): GroupTotal[] {
  const categorized = categoryTotals.reduce((sum, c) => sum + c.amount, 0);
  const uncategorized = totalExpenses - categorized;
  if (uncategorized <= 0.005) return categoryTotals;
  return [...categoryTotals, { id: "UNCATEGORIZED", name: "Uncategorized", amount: uncategorized }];
}

/**
 * Computes the Paycheck Breakdown pie. `groupTotals` is the EXPENSE
 * breakdown along whichever axis the caller picked (category or payment
 * method) — it must sum to exactly `totalExpenses`.
 *
 * scope "full" (default): every group, a Savings slice, and a Remaining
 * slice, all as a share of the quincena's income — except when
 * spending+savings exceeds income (overspent), in which case the pie's
 * total is the spent+saved amount instead (so slices always sum to exactly
 * 100% and Remaining is never negative).
 *
 * scope "spending": just the EXPENSE groups, no Savings/Remaining — the
 * pie's total is totalExpenses, so it's purely "how spending split up."
 */
export function computeBreakdown(
  financials: {
    baseIncome: number;
    extraIncome: number;
    totalExpenses: number;
    totalSavings: number;
    groupTotals: GroupTotal[];
  },
  options: {
    scope?: BreakdownScope;
    groupBy?: BreakdownGroupBy;
    thresholdPercent?: number;
  } = {},
): PaycheckBreakdown {
  const { scope = "full", groupBy = "category", thresholdPercent = DEFAULT_THRESHOLD_PERCENT } = options;

  const pieTotal =
    scope === "spending"
      ? financials.totalExpenses
      : Math.max(
          financials.baseIncome + financials.extraIncome,
          financials.totalExpenses + financials.totalSavings,
        );

  if (pieTotal <= 0) {
    return { pieTotal: 0, legendSlices: [], chartSlices: [] };
  }

  // Which categories will actually render as their own chart slice — same
  // rule the chart-only keep/fold split below applies (sorted by amount,
  // top MAX_CHART_GROUP_SLICES clearing thresholdPercent), computed here
  // first so assignCategoryColorIndexes can guarantee *those* get distinct
  // colors, rather than every category that merely exists regardless of
  // whether it's actually visible (most of which fold into "Other" and
  // colliding there is invisible). Sorted/indexed over the full,
  // unfiltered list — matching the later split's own indices exactly —
  // then UNCATEGORIZED is dropped from the result since it never draws
  // its own color slot either way (colorVarFor always routes it to
  // --chart-other).
  const sortedGroupTotals = [...financials.groupTotals].sort((a, b) => b.amount - a.amount);
  const chartVisibleIds =
    groupBy === "category"
      ? sortedGroupTotals
          .filter((g, i) => i < MAX_CHART_GROUP_SLICES && (g.amount / pieTotal) * 100 >= thresholdPercent)
          .map((g) => g.id)
          .filter((id) => id !== "UNCATEGORIZED")
      : [];

  const colorIndexes =
    groupBy === "category"
      ? assignCategoryColorIndexes(
          chartVisibleIds,
          financials.groupTotals.filter((g) => g.id !== "UNCATEGORIZED").map((g) => g.id),
        )
      : new Map();

  const groupSlices: BreakdownSlice[] = financials.groupTotals.map((g) => ({
    key: g.id,
    label: g.name,
    amount: g.amount,
    percentage: (g.amount / pieTotal) * 100,
    kind: "expense",
    colorVar: colorVarFor(g.id, groupBy, colorIndexes),
  }));

  const remaining =
    scope === "full" ? Math.max(pieTotal - financials.totalExpenses - financials.totalSavings, 0) : 0;

  const savingsSlice: BreakdownSlice | null =
    scope === "full" && financials.totalSavings > 0
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
    scope === "full" && remaining > 0
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
    ...groupSlices,
    ...(savingsSlice ? [savingsSlice] : []),
    ...(remainingSlice ? [remainingSlice] : []),
  ].sort((a, b) => b.amount - a.amount);

  // Chart-only grouping: fold sub-threshold groups, and (if there are still
  // more than the palette can give a distinct color to) the smallest excess
  // too, into one "Other" slice.
  const sortedGroups = [...groupSlices].sort((a, b) => b.amount - a.amount);
  const keptGroups: BreakdownSlice[] = [];
  const foldedGroups: BreakdownSlice[] = [];
  sortedGroups.forEach((slice, i) => {
    if (slice.percentage < thresholdPercent || i >= MAX_CHART_GROUP_SLICES) {
      foldedGroups.push(slice);
    } else {
      keptGroups.push(slice);
    }
  });

  const otherSlice: BreakdownSlice | null =
    foldedGroups.length > 0
      ? {
          key: "other",
          label: "Other",
          amount: foldedGroups.reduce((sum, s) => sum + s.amount, 0),
          percentage: foldedGroups.reduce((sum, s) => sum + s.percentage, 0),
          kind: "other",
          colorVar: "--chart-other",
          members: foldedGroups.sort((a, b) => b.amount - a.amount),
        }
      : null;

  const chartSlices = [
    ...keptGroups,
    ...(savingsSlice ? [savingsSlice] : []),
    ...(remainingSlice ? [remainingSlice] : []),
    ...(otherSlice ? [otherSlice] : []),
  ].sort((a, b) => b.amount - a.amount);

  return { pieTotal, legendSlices, chartSlices };
}

/**
 * Buckets each transaction under its slice's key (a category's id, a
 * payment method, or "savings"), capped at maxPerSlice — the "2-3 most
 * recent transactions" preview in the breakdown's detail panel. Relies on
 * `transactions` already being sorted newest-first (see getCycleFinancials),
 * so simply taking the first N per bucket gives the most recent N. Income
 * has no slice (Remaining/Other aren't real transaction buckets either).
 */
export function groupRecentTransactionsBySlice(
  transactions: CycleTransactionSummary[],
  groupBy: BreakdownGroupBy,
  categoryTotals: GroupTotal[],
  maxPerSlice = 3,
): Record<string, CycleTransactionSummary[]> {
  const nameToId = new Map(categoryTotals.map((c) => [c.name, c.id]));
  const result: Record<string, CycleTransactionSummary[]> = {};

  for (const tx of transactions) {
    let key: string | null = null;
    if (tx.type === "EXPENSE") {
      // Falls into the same "UNCATEGORIZED"/"UNSPECIFIED" bucket the totals
      // functions use for a transaction with no category or no payment
      // method, whether that's because it never had one or (categoryName
      // set but not in categoryTotals) it points at a category that's since
      // been renamed/merged away — either way, it's not any *known* group.
      key =
        groupBy === "category"
          ? ((tx.categoryName && nameToId.get(tx.categoryName)) ?? "UNCATEGORIZED")
          : (tx.paymentMethod ?? "UNSPECIFIED");
    } else if (tx.type === "SAVINGS") {
      key = "savings";
    }
    if (!key) continue;

    if (!result[key]) result[key] = [];
    if (result[key].length < maxPerSlice) result[key].push(tx);
  }

  return result;
}
