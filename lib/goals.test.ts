import { describe, expect, it } from "vitest";
import { summarizeGoalProgress } from "./goals";

function decimal(value: number) {
  return { toNumber: () => value };
}

describe("summarizeGoalProgress", () => {
  it("sums saved-so-far across every SAVINGS transaction for the category", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [decimal(200), decimal(50), decimal(100)].map((amount) => ({ amount })),
      budgetGoals: [],
    });
    expect(result.savedSoFar).toBe(350);
  });

  it("reports zero saved with no transactions", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [],
      budgetGoals: [],
    });
    expect(result.savedSoFar).toBe(0);
  });

  it("takes the current cycle's per-cycle contribution when one is set", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [],
      budgetGoals: [{ targetAmount: decimal(150) }],
    });
    expect(result.currentCycleRecurringAmount).toBe(150);
  });

  it("has no per-cycle contribution when the current cycle has no budgetGoal row", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [],
      budgetGoals: [],
    });
    expect(result.currentCycleRecurringAmount).toBeNull();
  });

  it("defaults lifetimeTargetAmount to 0 when null (shouldn't happen given the caller's filter, but stays safe)", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      name: "Emergency Fund",
      lifetimeTargetAmount: null,
      transactions: [],
      budgetGoals: [],
    });
    expect(result.lifetimeTargetAmount).toBe(0);
  });

  it("passes through categoryId and name unchanged", () => {
    const result = summarizeGoalProgress({
      id: "cat-42",
      name: "Pro Futuro",
      lifetimeTargetAmount: decimal(500),
      transactions: [],
      budgetGoals: [],
    });
    expect(result.categoryId).toBe("cat-42");
    expect(result.name).toBe("Pro Futuro");
  });
});
