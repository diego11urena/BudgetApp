import { describe, expect, it } from "vitest";
import { generateInsights } from "./insights";
import type { CycleFinancials } from "./cycle-financials";

function makeFinancials(overrides: Partial<CycleFinancials> = {}): CycleFinancials {
  return {
    baseIncome: 2000,
    extraIncome: 0,
    totalExpenses: 0,
    totalSavings: 0,
    amountLeft: 2000,
    transactions: [],
    categoryTotals: [],
    topCategories: [],
    ...overrides,
  };
}

describe("generateInsights", () => {
  // Regression anchor: generateInsights used to blanket-return [] whenever
  // there was no closed cycle history, hiding the Insights card entirely
  // for a first-time user -- even the on-track/over-budget rule, which
  // needs only the current cycle's own numbers and has nothing to do with
  // history. Only the genuinely comparative rules (category-delta,
  // streak) should require previousClosedFinancials.
  it("still shows the on-track insight for a brand-new user with no closed cycles yet", () => {
    const insights = generateInsights(makeFinancials({ amountLeft: 2000 }), []);
    expect(insights).toEqual(["You're on track to have $2,000.00 left this cycle."]);
  });

  it("still shows the over-budget insight for a brand-new user with no closed cycles yet", () => {
    const insights = generateInsights(makeFinancials({ amountLeft: -50 }), []);
    expect(insights).toEqual(["You're $50.00 over budget this cycle so far."]);
  });

  it("never reports a comparative category-delta or streak insight with no closed cycles", () => {
    const current = makeFinancials({
      amountLeft: 100,
      topCategories: [{ categoryId: "c1", categoryName: "Groceries", amount: 200 }],
    });
    const insights = generateInsights(current, []);
    expect(insights.some((text) => text.includes("vs last cycle"))).toBe(false);
    expect(insights.some((text) => text.includes("cycles in a row"))).toBe(false);
  });

  it("reports a category increase vs the most recent closed cycle", () => {
    const current = makeFinancials({
      amountLeft: 1000,
      topCategories: [{ categoryId: "c1", categoryName: "Groceries", amount: 200 }],
    });
    const previous = makeFinancials({
      amountLeft: 1200,
      categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", amount: 158 }],
    });

    const insights = generateInsights(current, [previous]);
    expect(insights[0]).toBe("Groceries spending is up $42.00 vs last cycle.");
  });

  it("reports a category decrease vs the most recent closed cycle", () => {
    const current = makeFinancials({
      amountLeft: 1000,
      topCategories: [{ categoryId: "c1", categoryName: "Groceries", amount: 100 }],
    });
    const previous = makeFinancials({
      categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", amount: 158 }],
    });

    const insights = generateInsights(current, [previous]);
    expect(insights[0]).toBe("Groceries spending is down $58.00 vs last cycle.");
  });

  it("still matches the category across a rename (id stable, name changed)", () => {
    const current = makeFinancials({
      amountLeft: 1000,
      topCategories: [{ categoryId: "c1", categoryName: "Food", amount: 200 }],
    });
    const previous = makeFinancials({
      categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", amount: 150 }],
    });

    const insights = generateInsights(current, [previous]);
    expect(insights[0]).toBe("Food spending is up $50.00 vs last cycle.");
  });

  it("does not false-match two different categories that happen to share a name", () => {
    const current = makeFinancials({
      amountLeft: 1000,
      topCategories: [{ categoryId: "c1", categoryName: "Travel", amount: 200 }],
    });
    const previous = makeFinancials({
      categoryTotals: [{ categoryId: "c2", categoryName: "Travel", amount: 158 }],
    });

    const insights = generateInsights(current, [previous]);
    expect(insights[0]).not.toContain("Travel spending is");
  });

  it("restates a positive amount left as on-track", () => {
    const insights = generateInsights(makeFinancials({ amountLeft: 630 }), [makeFinancials()]);
    expect(insights).toContain("You're on track to have $630.00 left this cycle.");
  });

  it("restates a negative amount left as over budget", () => {
    const insights = generateInsights(makeFinancials({ amountLeft: -75 }), [makeFinancials()]);
    expect(insights).toContain("You're $75.00 over budget this cycle so far.");
  });

  it("reports an under-budget streak of 2 or more", () => {
    const previous = [
      makeFinancials({ amountLeft: 100 }),
      makeFinancials({ amountLeft: 50 }),
      makeFinancials({ amountLeft: -10 }),
    ];
    const insights = generateInsights(makeFinancials({ amountLeft: 200 }), previous);
    expect(insights).toContain("You've stayed under budget for 2 cycles in a row.");
  });

  it("does not report a streak of only 1", () => {
    const previous = [makeFinancials({ amountLeft: -10 }), makeFinancials({ amountLeft: 100 })];
    const insights = generateInsights(makeFinancials({ amountLeft: 200 }), previous);
    expect(insights.some((text) => text.includes("cycles in a row"))).toBe(false);
  });

  it("caps output at 3 insights", () => {
    const current = makeFinancials({
      amountLeft: 200,
      topCategories: [{ categoryId: "c1", categoryName: "Groceries", amount: 200 }],
    });
    const previous = [
      makeFinancials({
        amountLeft: 50,
        categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", amount: 100 }],
      }),
      makeFinancials({ amountLeft: 50 }),
      makeFinancials({ amountLeft: 50 }),
    ];
    const insights = generateInsights(current, previous);
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});
