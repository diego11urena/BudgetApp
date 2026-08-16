import { describe, expect, it } from "vitest";
import {
  computeBreakdown,
  computePaymentMethodTotals,
  groupRecentTransactionsBySlice,
  withUncategorizedBucket,
} from "./paycheck-breakdown";

describe("computeBreakdown", () => {
  it("returns empty slices when there's no income and no spending", () => {
    const result = computeBreakdown({
      baseIncome: 0,
      extraIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      groupTotals: [],
    });
    expect(result.pieTotal).toBe(0);
    expect(result.legendSlices).toEqual([]);
    expect(result.chartSlices).toEqual([]);
  });

  it("splits income into groups, savings, and remaining, summing to pieTotal", () => {
    const result = computeBreakdown({
      baseIncome: 800,
      extraIncome: 200,
      totalExpenses: 300,
      totalSavings: 100,
      groupTotals: [{ id: "rent", name: "Rent", amount: 300 }],
    });
    expect(result.pieTotal).toBe(1000);
    const total = result.legendSlices.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBe(1000);
    const remaining = result.legendSlices.find((s) => s.kind === "remaining");
    expect(remaining?.amount).toBe(600);
    expect(remaining?.percentage).toBeCloseTo(60);
  });

  it("omits the Savings slice entirely when nothing was saved", () => {
    const result = computeBreakdown({
      baseIncome: 500,
      extraIncome: 0,
      totalExpenses: 100,
      totalSavings: 0,
      groupTotals: [{ id: "food", name: "Food", amount: 100 }],
    });
    expect(result.legendSlices.some((s) => s.kind === "savings")).toBe(false);
  });

  it("omits the Remaining slice when spending+savings exactly equals income", () => {
    const result = computeBreakdown({
      baseIncome: 100,
      extraIncome: 0,
      totalExpenses: 100,
      totalSavings: 0,
      groupTotals: [{ id: "food", name: "Food", amount: 100 }],
    });
    expect(result.legendSlices.some((s) => s.kind === "remaining")).toBe(false);
  });

  it("when overspent, pieTotal is spending+savings (not income), and Remaining is omitted rather than negative", () => {
    const result = computeBreakdown({
      baseIncome: 100,
      extraIncome: 0,
      totalExpenses: 150,
      totalSavings: 0,
      groupTotals: [{ id: "food", name: "Food", amount: 150 }],
    });
    expect(result.pieTotal).toBe(150);
    expect(result.legendSlices.some((s) => s.kind === "remaining")).toBe(false);
    const food = result.legendSlices.find((s) => s.key === "food");
    expect(food?.percentage).toBeCloseTo(100);
  });

  it("legend lists every group individually even when small, sorted by amount descending", () => {
    const result = computeBreakdown({
      baseIncome: 1000,
      extraIncome: 0,
      totalExpenses: 100,
      totalSavings: 0,
      groupTotals: [
        { id: "a", name: "A", amount: 60 },
        { id: "b", name: "B", amount: 30 },
        { id: "c", name: "C", amount: 10 },
      ],
    });
    const names = result.legendSlices.filter((s) => s.kind === "expense").map((s) => s.label);
    expect(names).toEqual(["A", "B", "C"]);
  });

  it("folds groups under the threshold into one chart-only 'Other' slice, but keeps them individually in the legend", () => {
    const result = computeBreakdown(
      {
        baseIncome: 100,
        extraIncome: 0,
        totalExpenses: 100,
        totalSavings: 0,
        groupTotals: [
          { id: "big", name: "Big", amount: 90 },
          { id: "tiny1", name: "Tiny1", amount: 6 },
          { id: "tiny2", name: "Tiny2", amount: 4 },
        ],
      },
      { thresholdPercent: 5 },
    );
    // legend: every group present individually
    expect(
      result.legendSlices.filter((s) => s.kind === "expense").map((s) => s.label).sort(),
    ).toEqual(["Big", "Tiny1", "Tiny2"]);

    // chart: tiny1 (6%) stays above threshold, tiny2 (4%) folds into Other
    const chartLabels = result.chartSlices.map((s) => s.label);
    expect(chartLabels).toContain("Big");
    expect(chartLabels).toContain("Tiny1");
    expect(chartLabels).toContain("Other");
    expect(chartLabels).not.toContain("Tiny2");

    const other = result.chartSlices.find((s) => s.kind === "other");
    expect(other?.amount).toBe(4);
    expect(other?.members?.map((m) => m.label)).toEqual(["Tiny2"]);
  });

  it("folds excess groups beyond the fixed color count into Other even if individually above threshold", () => {
    const groupTotals = Array.from({ length: 8 }, (_, i) => ({
      id: `cat-${i}`,
      name: `Cat ${i}`,
      amount: 100 - i, // all well above a 5% threshold of ~700 total
    }));
    const result = computeBreakdown({
      baseIncome: 700,
      extraIncome: 0,
      totalExpenses: 700,
      totalSavings: 0,
      groupTotals,
    });
    const other = result.chartSlices.find((s) => s.kind === "other");
    expect(other).toBeDefined();
    expect(other?.members?.length).toBe(2); // the 2 smallest of the 8
    expect(result.chartSlices.filter((s) => s.kind === "expense")).toHaveLength(6);
    // legend still lists all 8 individually
    expect(result.legendSlices.filter((s) => s.kind === "expense")).toHaveLength(8);
  });

  it("assigns a stable colorVar per category regardless of other categories' amounts", () => {
    const a = computeBreakdown({
      baseIncome: 100,
      extraIncome: 0,
      totalExpenses: 50,
      totalSavings: 0,
      groupTotals: [{ id: "groceries", name: "Groceries", amount: 50 }],
    });
    const b = computeBreakdown({
      baseIncome: 200,
      extraIncome: 0,
      totalExpenses: 150,
      totalSavings: 0,
      groupTotals: [
        { id: "groceries", name: "Groceries", amount: 50 },
        { id: "rent", name: "Rent", amount: 100 },
      ],
    });
    const colorA = a.legendSlices.find((s) => s.key === "groceries")?.colorVar;
    const colorB = b.legendSlices.find((s) => s.key === "groceries")?.colorVar;
    expect(colorA).toBe(colorB);
  });

  it("gives every category a distinct chart color when there are no more categories than palette slots", () => {
    const groupTotals = ["Rent", "Groceries", "Dining", "Transportation", "Spotify", "Coffee"].map(
      (name, i) => ({ id: `cat-${i}`, name, amount: 10 + i }),
    );
    const result = computeBreakdown({
      baseIncome: 1000,
      extraIncome: 0,
      totalExpenses: groupTotals.reduce((sum, c) => sum + c.amount, 0),
      totalSavings: 0,
      groupTotals,
    });
    const colors = result.legendSlices.filter((s) => s.kind === "expense").map((s) => s.colorVar);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("gives the 6 visible chart slices distinct colors even with more categories than the palette has slots, even though a folded 'Other' member can still collide with one", () => {
    // 9 categories, all clearing the 5% threshold and none tied on amount
    // -- exactly the top 6 by amount end up as their own chart slice, the
    // bottom 3 fold into "Other". Before this fix, color assignment ran
    // across all 9 regardless of which 6 would actually be visible, so two
    // of the *visible* slices could land on the same hash-preferred color
    // once there were more categories than palette slots (confirmed live:
    // "Rent" and "Entertainment" rendering as nearly the same pink).
    const groupTotals = Array.from({ length: 9 }, (_, i) => ({
      id: `cat-${i}`,
      name: `Category ${i}`,
      amount: 100 - i, // strictly descending, so rank order is unambiguous
    }));
    const result = computeBreakdown({
      baseIncome: groupTotals.reduce((sum, c) => sum + c.amount, 0),
      extraIncome: 0,
      totalExpenses: groupTotals.reduce((sum, c) => sum + c.amount, 0),
      totalSavings: 0,
      groupTotals,
    });

    const visibleColors = result.chartSlices
      .filter((s) => s.kind === "expense")
      .map((s) => s.colorVar);
    expect(visibleColors).toHaveLength(6);
    expect(new Set(visibleColors).size).toBe(6);

    // The "Other" slice exists (3 categories folded into it) — confirming
    // this test actually exercises the >6-categories case, not just a
    // 6-or-fewer one that would trivially pass either way.
    expect(result.chartSlices.some((s) => s.kind === "other")).toBe(true);
  });

  describe("scope: spending", () => {
    it("excludes Savings and Remaining even when income exceeds spending", () => {
      const result = computeBreakdown(
        {
          baseIncome: 1000,
          extraIncome: 0,
          totalExpenses: 200,
          totalSavings: 100,
          groupTotals: [{ id: "food", name: "Food", amount: 200 }],
        },
        { scope: "spending" },
      );
      expect(result.legendSlices.some((s) => s.kind === "savings")).toBe(false);
      expect(result.legendSlices.some((s) => s.kind === "remaining")).toBe(false);
      expect(result.pieTotal).toBe(200);
    });

    it("groups sum to exactly 100% of totalExpenses", () => {
      const result = computeBreakdown(
        {
          baseIncome: 1000,
          extraIncome: 0,
          totalExpenses: 200,
          totalSavings: 100,
          groupTotals: [
            { id: "food", name: "Food", amount: 150 },
            { id: "gas", name: "Gas", amount: 50 },
          ],
        },
        { scope: "spending" },
      );
      const totalPercent = result.legendSlices.reduce((sum, s) => sum + s.percentage, 0);
      expect(totalPercent).toBeCloseTo(100);
    });

    it("is empty (pieTotal 0) when there's no spending, even with income", () => {
      const result = computeBreakdown(
        { baseIncome: 1000, extraIncome: 0, totalExpenses: 0, totalSavings: 0, groupTotals: [] },
        { scope: "spending" },
      );
      expect(result.pieTotal).toBe(0);
    });
  });

  describe("groupBy: paymentMethod", () => {
    it("uses the fixed payment-method color map instead of the category hash", () => {
      const result = computeBreakdown(
        {
          baseIncome: 100,
          extraIncome: 0,
          totalExpenses: 100,
          totalSavings: 0,
          groupTotals: [
            { id: "CASH", name: "Cash", amount: 40 },
            { id: "CREDIT_CARD", name: "Credit Card", amount: 60 },
          ],
        },
        { groupBy: "paymentMethod" },
      );
      const cash = result.legendSlices.find((s) => s.key === "CASH");
      const credit = result.legendSlices.find((s) => s.key === "CREDIT_CARD");
      expect(cash?.colorVar).toBe("--chart-cat-1");
      expect(credit?.colorVar).toBe("--chart-cat-2");
    });

    it("gives the Unspecified bucket the Other color", () => {
      const result = computeBreakdown(
        {
          baseIncome: 100,
          extraIncome: 0,
          totalExpenses: 100,
          totalSavings: 0,
          groupTotals: [{ id: "UNSPECIFIED", name: "Unspecified", amount: 100 }],
        },
        { groupBy: "paymentMethod" },
      );
      expect(result.legendSlices[0].colorVar).toBe("--chart-other");
    });
  });

  it("regression: category-grouped slices sum to exactly 100% even with an uncategorized expense (previously silently dropped)", () => {
    // Income $1000; Rent $500 (categorized), an uncategorized Yappy send
    // $20, totalExpenses must include both.
    const categoryTotals = [{ id: "rent", name: "Rent", amount: 500 }];
    const totalExpenses = 520;
    const result = computeBreakdown({
      baseIncome: 1000,
      extraIncome: 0,
      totalExpenses,
      totalSavings: 0,
      groupTotals: withUncategorizedBucket(categoryTotals, totalExpenses),
    });
    const totalPercent = result.legendSlices.reduce((sum, s) => sum + s.percentage, 0);
    expect(totalPercent).toBeCloseTo(100);
    const uncategorized = result.legendSlices.find((s) => s.key === "UNCATEGORIZED");
    expect(uncategorized?.amount).toBe(20);
    expect(uncategorized?.colorVar).toBe("--chart-other");
  });
});

describe("withUncategorizedBucket", () => {
  it("appends an Uncategorized bucket sized as the residual", () => {
    const result = withUncategorizedBucket([{ id: "rent", name: "Rent", amount: 500 }], 520);
    expect(result).toEqual([
      { id: "rent", name: "Rent", amount: 500 },
      { id: "UNCATEGORIZED", name: "Uncategorized", amount: 20 },
    ]);
  });

  it("adds nothing when categoryTotals already accounts for all of totalExpenses", () => {
    const result = withUncategorizedBucket([{ id: "rent", name: "Rent", amount: 500 }], 500);
    expect(result).toEqual([{ id: "rent", name: "Rent", amount: 500 }]);
  });

  it("tolerates tiny floating-point residue without adding a spurious bucket", () => {
    const result = withUncategorizedBucket([{ id: "rent", name: "Rent", amount: 500 }], 500.0000000001);
    expect(result).toEqual([{ id: "rent", name: "Rent", amount: 500 }]);
  });

  it("handles an empty categoryTotals list (everything uncategorized)", () => {
    const result = withUncategorizedBucket([], 100);
    expect(result).toEqual([{ id: "UNCATEGORIZED", name: "Uncategorized", amount: 100 }]);
  });
});

describe("computePaymentMethodTotals", () => {
  function tx(overrides: Partial<{ type: "EXPENSE" | "INCOME" | "SAVINGS"; paymentMethod: string | null; amount: number }>) {
    return {
      id: Math.random().toString(),
      cycleId: "cycle-1",
      type: overrides.type ?? "EXPENSE",
      name: "x",
      amount: overrides.amount ?? 10,
      categoryName: null,
      occurredAt: new Date(),
      isImported: false,
      importSource: "MANUAL" as const,
      paymentMethod: (overrides.paymentMethod ?? null) as
        | "CASH"
        | "CREDIT_CARD"
        | "DEBIT_CARD"
        | "YAPPY"
        | null,
      description: null,
    };
  }

  it("sums EXPENSE transactions by payment method", () => {
    const result = computePaymentMethodTotals([
      tx({ paymentMethod: "CASH", amount: 10 }),
      tx({ paymentMethod: "CASH", amount: 5 }),
      tx({ paymentMethod: "CREDIT_CARD", amount: 20 }),
    ]);
    expect(result.find((g) => g.id === "CASH")?.amount).toBe(15);
    expect(result.find((g) => g.id === "CREDIT_CARD")?.amount).toBe(20);
  });

  it("buckets a null payment method under Unspecified", () => {
    const result = computePaymentMethodTotals([tx({ paymentMethod: null, amount: 10 })]);
    expect(result).toEqual([{ id: "UNSPECIFIED", name: "Unspecified", amount: 10 }]);
  });

  it("ignores INCOME and SAVINGS transactions", () => {
    const result = computePaymentMethodTotals([
      tx({ type: "INCOME", amount: 100 }),
      tx({ type: "SAVINGS", amount: 50 }),
    ]);
    expect(result).toEqual([]);
  });

  it("sorts descending by amount", () => {
    const result = computePaymentMethodTotals([
      tx({ paymentMethod: "CASH", amount: 5 }),
      tx({ paymentMethod: "YAPPY", amount: 50 }),
    ]);
    expect(result.map((g) => g.id)).toEqual(["YAPPY", "CASH"]);
  });
});

describe("groupRecentTransactionsBySlice", () => {
  const categoryTotals = [
    { id: "groceries", name: "Groceries", amount: 50 },
    { id: "rent", name: "Rent", amount: 800 },
  ];

  function tx(
    overrides: Partial<{
      id: string;
      type: "EXPENSE" | "INCOME" | "SAVINGS";
      categoryName: string | null;
      paymentMethod: string | null;
    }>,
  ) {
    return {
      id: overrides.id ?? Math.random().toString(),
      cycleId: "cycle-1",
      type: overrides.type ?? "EXPENSE",
      name: "x",
      amount: 10,
      categoryName: overrides.categoryName ?? null,
      occurredAt: new Date(),
      isImported: false,
      importSource: "MANUAL" as const,
      paymentMethod: (overrides.paymentMethod ?? null) as
        | "CASH"
        | "CREDIT_CARD"
        | "DEBIT_CARD"
        | "YAPPY"
        | null,
      description: null,
    };
  }

  describe("groupBy: category", () => {
    it("buckets EXPENSE transactions by their category's id", () => {
      const result = groupRecentTransactionsBySlice(
        [tx({ id: "1", categoryName: "Groceries" }), tx({ id: "2", categoryName: "Rent" })],
        "category",
        categoryTotals,
      );
      expect(result.groceries.map((t) => t.id)).toEqual(["1"]);
      expect(result.rent.map((t) => t.id)).toEqual(["2"]);
    });

    it("buckets an EXPENSE transaction under UNCATEGORIZED when it has no category", () => {
      const result = groupRecentTransactionsBySlice([tx({ id: "1", categoryName: null })], "category", categoryTotals);
      expect(result.UNCATEGORIZED.map((t) => t.id)).toEqual(["1"]);
    });

    it("also buckets under UNCATEGORIZED when the category name doesn't match any known category (defensive — e.g. renamed/merged away)", () => {
      const result = groupRecentTransactionsBySlice(
        [tx({ id: "1", categoryName: "Some Deleted Category" })],
        "category",
        categoryTotals,
      );
      expect(result.UNCATEGORIZED.map((t) => t.id)).toEqual(["1"]);
    });
  });

  describe("groupBy: paymentMethod", () => {
    it("buckets EXPENSE transactions by their payment method", () => {
      const result = groupRecentTransactionsBySlice(
        [tx({ id: "1", paymentMethod: "CASH" }), tx({ id: "2", paymentMethod: "CREDIT_CARD" })],
        "paymentMethod",
        [],
      );
      expect(result.CASH.map((t) => t.id)).toEqual(["1"]);
      expect(result.CREDIT_CARD.map((t) => t.id)).toEqual(["2"]);
    });

    it("buckets a null payment method under UNSPECIFIED", () => {
      const result = groupRecentTransactionsBySlice([tx({ id: "1", paymentMethod: null })], "paymentMethod", []);
      expect(result.UNSPECIFIED.map((t) => t.id)).toEqual(["1"]);
    });
  });

  it("buckets every SAVINGS transaction under one combined 'savings' key regardless of grouping axis", () => {
    const result = groupRecentTransactionsBySlice(
      [
        tx({ id: "1", type: "SAVINGS", categoryName: "Emergency Fund" }),
        tx({ id: "2", type: "SAVINGS", categoryName: "Vacation" }),
      ],
      "category",
      categoryTotals,
    );
    expect(result.savings.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("ignores INCOME transactions entirely", () => {
    const result = groupRecentTransactionsBySlice([tx({ type: "INCOME" })], "category", categoryTotals);
    expect(result).toEqual({});
  });

  it("caps each bucket at maxPerSlice, keeping the first (most recent, per input order)", () => {
    const result = groupRecentTransactionsBySlice(
      [
        tx({ id: "1", categoryName: "Groceries" }),
        tx({ id: "2", categoryName: "Groceries" }),
        tx({ id: "3", categoryName: "Groceries" }),
        tx({ id: "4", categoryName: "Groceries" }),
      ],
      "category",
      categoryTotals,
      3,
    );
    expect(result.groceries.map((t) => t.id)).toEqual(["1", "2", "3"]);
  });
});
