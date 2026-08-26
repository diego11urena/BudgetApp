import { describe, expect, it } from "vitest";
import { summarizeGoalProgress, validateContributionDelta } from "./goals";

function decimal(value: number) {
  return { toNumber: () => value };
}

describe("summarizeGoalProgress", () => {
  it("sums saved-so-far across every SAVINGS transaction for the category", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [decimal(200), decimal(50), decimal(100)].map((amount) => ({ amount })),
      budgetGoals: [],
      manualAdjustment: decimal(0),
    });
    expect(result.savedSoFar).toBe(350);
  });

  it("reports zero saved with no transactions and no manual adjustment", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [],
      budgetGoals: [],
      manualAdjustment: decimal(0),
    });
    expect(result.savedSoFar).toBe(0);
  });

  it("takes the current cycle's per-cycle contribution when one is set", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [],
      budgetGoals: [{ targetAmount: decimal(150) }],
      manualAdjustment: decimal(0),
    });
    expect(result.currentCycleRecurringAmount).toBe(150);
  });

  it("has no per-cycle contribution when the current cycle has no budgetGoal row", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [],
      budgetGoals: [],
      manualAdjustment: decimal(0),
    });
    expect(result.currentCycleRecurringAmount).toBeNull();
  });

  it("defaults lifetimeTargetAmount to 0 when null (shouldn't happen given the caller's filter, but stays safe)", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Emergency Fund",
      lifetimeTargetAmount: null,
      transactions: [],
      budgetGoals: [],
      manualAdjustment: decimal(0),
    });
    expect(result.lifetimeTargetAmount).toBe(0);
  });

  it("passes through categoryId and name unchanged", () => {
    const result = summarizeGoalProgress({
      id: "cat-42",
      icon: null,
      name: "Pro Futuro",
      lifetimeTargetAmount: decimal(500),
      transactions: [],
      budgetGoals: [],
      manualAdjustment: decimal(0),
    });
    expect(result.categoryId).toBe("cat-42");
    expect(result.name).toBe("Pro Futuro");
  });

  // manualAdjustment covers two real scenarios: an opening balance entered
  // at goal creation ("I already have $450 saved"), and a correction made
  // later without logging a phantom transaction (see
  // updateGoalWithContributionAction in goals/actions.ts). Both cases just
  // add into the same total as real transactions -- this is the one place
  // that combination happens.
  it("adds manualAdjustment on top of the transaction sum", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Vacation",
      lifetimeTargetAmount: decimal(2000),
      transactions: [decimal(100)].map((amount) => ({ amount })),
      budgetGoals: [],
      manualAdjustment: decimal(450),
    });
    expect(result.savedSoFar).toBe(550);
  });

  it("reflects manualAdjustment alone when there are no transactions yet (a brand-new goal with an opening balance)", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Vacation",
      lifetimeTargetAmount: decimal(2000),
      transactions: [],
      budgetGoals: [],
      manualAdjustment: decimal(450),
    });
    expect(result.savedSoFar).toBe(450);
  });

  // Regression anchor: every goal that existed before manualAdjustment was
  // added defaults to 0 (the Prisma column default) -- confirms an
  // existing goal's savedSoFar is completely unaffected by this field
  // existing at all.
  it("leaves an existing goal's total unchanged when manualAdjustment is the column default of 0", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Emergency Fund",
      lifetimeTargetAmount: decimal(1000),
      transactions: [decimal(300), decimal(75)].map((amount) => ({ amount })),
      budgetGoals: [],
      manualAdjustment: decimal(0),
    });
    expect(result.savedSoFar).toBe(375);
  });

  it("handles a negative manualAdjustment (a correction bringing the total down)", () => {
    const result = summarizeGoalProgress({
      id: "cat-1",
      icon: null,
      name: "Vacation",
      lifetimeTargetAmount: decimal(2000),
      transactions: [decimal(700)].map((amount) => ({ amount })),
      budgetGoals: [],
      manualAdjustment: decimal(-200),
    });
    expect(result.savedSoFar).toBe(500);
  });
});

describe("validateContributionDelta", () => {
  it("accepts an increase and reports the new total", () => {
    const result = validateContributionDelta(500, 200);
    expect(result).toEqual({ ok: true, newSavedSoFar: 700 });
  });

  it("accepts a decrease that stays non-negative", () => {
    const result = validateContributionDelta(500, -200);
    expect(result).toEqual({ ok: true, newSavedSoFar: 300 });
  });

  it("accepts a decrease that lands exactly on zero", () => {
    const result = validateContributionDelta(500, -500);
    expect(result).toEqual({ ok: true, newSavedSoFar: 0 });
  });

  // Regression anchor: the one hard rule the whole editing feature depends
  // on -- manualAdjustment must never be able to drive the tracked total
  // negative, since a negative savedSoFar has no sensible meaning for a
  // savings goal (computeGoalProjection's percentage/remaining math
  // assumes >= 0).
  it("rejects a decrease that would make the total negative", () => {
    const result = validateContributionDelta(500, -600);
    expect(result).toEqual({ ok: false, error: "That would make the saved total negative" });
  });

  it("rounds to the nearest cent instead of accumulating floating-point drift", () => {
    const result = validateContributionDelta(0.1, 0.2);
    expect(result).toEqual({ ok: true, newSavedSoFar: 0.3 });
  });
});
