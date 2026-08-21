import { describe, expect, it } from "vitest";
import { summarizeCategoryUsage } from "./category-usage";

describe("summarizeCategoryUsage", () => {
  it("marks a category with transactions as used, not unused", () => {
    const result = summarizeCategoryUsage({
      categoryId: "cat-1",
      transactionCount: 32,
      totalAmount: 486.2,
      hasBudgetGoal: false,
    });
    expect(result.isUnused).toBe(false);
    expect(result.transactionCount).toBe(32);
    expect(result.totalAmount).toBe(486.2);
  });

  // A freshly-added recurring fixed expense (e.g. "Rent: $800/cycle") may
  // have zero transactions logged yet -- it must not be relegated to the
  // "Unused categories" section just because no payment has happened yet.
  it("marks a category with a budget goal but zero transactions as used", () => {
    const result = summarizeCategoryUsage({
      categoryId: "cat-1",
      transactionCount: 0,
      totalAmount: 0,
      hasBudgetGoal: true,
    });
    expect(result.isUnused).toBe(false);
  });

  it("marks a category with neither transactions nor a budget goal as unused", () => {
    const result = summarizeCategoryUsage({
      categoryId: "cat-1",
      transactionCount: 0,
      totalAmount: 0,
      hasBudgetGoal: false,
    });
    expect(result.isUnused).toBe(true);
  });

  it("passes categoryId through unchanged", () => {
    const result = summarizeCategoryUsage({
      categoryId: "cat-42",
      transactionCount: 1,
      totalAmount: 10,
      hasBudgetGoal: false,
    });
    expect(result.categoryId).toBe("cat-42");
  });
});
