import { describe, expect, it } from "vitest";
import { computeBreakdown, groupRecentTransactionsBySlice } from "./paycheck-breakdown";

describe("computeBreakdown", () => {
  it("returns empty slices when there's no income and no spending", () => {
    const result = computeBreakdown({
      baseIncome: 0,
      extraIncome: 0,
      totalExpenses: 0,
      totalSavings: 0,
      categoryTotals: [],
    });
    expect(result.pieTotal).toBe(0);
    expect(result.legendSlices).toEqual([]);
    expect(result.chartSlices).toEqual([]);
  });

  it("splits income into categories, savings, and remaining, summing to pieTotal", () => {
    const result = computeBreakdown({
      baseIncome: 800,
      extraIncome: 200,
      totalExpenses: 300,
      totalSavings: 100,
      categoryTotals: [{ categoryId: "rent", categoryName: "Rent", amount: 300 }],
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
      categoryTotals: [{ categoryId: "food", categoryName: "Food", amount: 100 }],
    });
    expect(result.legendSlices.some((s) => s.kind === "savings")).toBe(false);
  });

  it("omits the Remaining slice when spending+savings exactly equals income", () => {
    const result = computeBreakdown({
      baseIncome: 100,
      extraIncome: 0,
      totalExpenses: 100,
      totalSavings: 0,
      categoryTotals: [{ categoryId: "food", categoryName: "Food", amount: 100 }],
    });
    expect(result.legendSlices.some((s) => s.kind === "remaining")).toBe(false);
  });

  it("when overspent, pieTotal is spending+savings (not income), and Remaining is omitted rather than negative", () => {
    const result = computeBreakdown({
      baseIncome: 100,
      extraIncome: 0,
      totalExpenses: 150,
      totalSavings: 0,
      categoryTotals: [{ categoryId: "food", categoryName: "Food", amount: 150 }],
    });
    expect(result.pieTotal).toBe(150);
    expect(result.legendSlices.some((s) => s.kind === "remaining")).toBe(false);
    const food = result.legendSlices.find((s) => s.key === "food");
    expect(food?.percentage).toBeCloseTo(100);
  });

  it("legend lists every category individually even when small, sorted by amount descending", () => {
    const result = computeBreakdown({
      baseIncome: 1000,
      extraIncome: 0,
      totalExpenses: 100,
      totalSavings: 0,
      categoryTotals: [
        { categoryId: "a", categoryName: "A", amount: 60 },
        { categoryId: "b", categoryName: "B", amount: 30 },
        { categoryId: "c", categoryName: "C", amount: 10 },
      ],
    });
    const names = result.legendSlices.filter((s) => s.kind === "expense").map((s) => s.label);
    expect(names).toEqual(["A", "B", "C"]);
  });

  it("folds categories under the threshold into one chart-only 'Other' slice, but keeps them individually in the legend", () => {
    const result = computeBreakdown(
      {
        baseIncome: 100,
        extraIncome: 0,
        totalExpenses: 100,
        totalSavings: 0,
        categoryTotals: [
          { categoryId: "big", categoryName: "Big", amount: 90 },
          { categoryId: "tiny1", categoryName: "Tiny1", amount: 6 },
          { categoryId: "tiny2", categoryName: "Tiny2", amount: 4 },
        ],
      },
      5,
    );
    // legend: every category present individually
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

  it("folds excess categories beyond the fixed color count into Other even if individually above threshold", () => {
    const categoryTotals = Array.from({ length: 8 }, (_, i) => ({
      categoryId: `cat-${i}`,
      categoryName: `Cat ${i}`,
      amount: 100 - i, // all well above a 5% threshold of ~700 total
    }));
    const result = computeBreakdown({
      baseIncome: 700,
      extraIncome: 0,
      totalExpenses: 700,
      totalSavings: 0,
      categoryTotals,
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
      categoryTotals: [{ categoryId: "groceries", categoryName: "Groceries", amount: 50 }],
    });
    const b = computeBreakdown({
      baseIncome: 200,
      extraIncome: 0,
      totalExpenses: 150,
      totalSavings: 0,
      categoryTotals: [
        { categoryId: "groceries", categoryName: "Groceries", amount: 50 },
        { categoryId: "rent", categoryName: "Rent", amount: 100 },
      ],
    });
    const colorA = a.legendSlices.find((s) => s.key === "groceries")?.colorVar;
    const colorB = b.legendSlices.find((s) => s.key === "groceries")?.colorVar;
    expect(colorA).toBe(colorB);
  });

  it("gives every category a distinct chart color when there are no more categories than palette slots", () => {
    const categoryTotals = ["Rent", "Groceries", "Dining", "Transportation", "Spotify", "Coffee"].map(
      (name, i) => ({ categoryId: `cat-${i}`, categoryName: name, amount: 10 + i }),
    );
    const result = computeBreakdown({
      baseIncome: 1000,
      extraIncome: 0,
      totalExpenses: categoryTotals.reduce((sum, c) => sum + c.amount, 0),
      totalSavings: 0,
      categoryTotals,
    });
    const colors = result.legendSlices.filter((s) => s.kind === "expense").map((s) => s.colorVar);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("groupRecentTransactionsBySlice", () => {
  const categoryTotals = [
    { categoryId: "groceries", categoryName: "Groceries", amount: 50 },
    { categoryId: "rent", categoryName: "Rent", amount: 800 },
  ];

  function tx(overrides: Partial<{ id: string; type: "EXPENSE" | "INCOME" | "SAVINGS"; categoryName: string | null }>) {
    return {
      id: overrides.id ?? Math.random().toString(),
      type: overrides.type ?? "EXPENSE",
      name: "x",
      amount: 10,
      categoryName: overrides.categoryName ?? null,
      occurredAt: new Date(),
      isImported: false,
      source: "MANUAL" as const,
    };
  }

  it("buckets EXPENSE transactions by their category's id", () => {
    const result = groupRecentTransactionsBySlice(
      [tx({ id: "1", categoryName: "Groceries" }), tx({ id: "2", categoryName: "Rent" })],
      categoryTotals,
    );
    expect(result.groceries.map((t) => t.id)).toEqual(["1"]);
    expect(result.rent.map((t) => t.id)).toEqual(["2"]);
  });

  it("buckets every SAVINGS transaction under one combined 'savings' key regardless of its own category", () => {
    const result = groupRecentTransactionsBySlice(
      [
        tx({ id: "1", type: "SAVINGS", categoryName: "Emergency Fund" }),
        tx({ id: "2", type: "SAVINGS", categoryName: "Vacation" }),
      ],
      categoryTotals,
    );
    expect(result.savings.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("ignores INCOME transactions entirely", () => {
    const result = groupRecentTransactionsBySlice([tx({ type: "INCOME" })], categoryTotals);
    expect(result).toEqual({});
  });

  it("ignores an EXPENSE transaction whose category name doesn't match any known category (defensive)", () => {
    const result = groupRecentTransactionsBySlice(
      [tx({ categoryName: "Some Deleted Category" })],
      categoryTotals,
    );
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
      categoryTotals,
      3,
    );
    expect(result.groceries.map((t) => t.id)).toEqual(["1", "2", "3"]);
  });
});
