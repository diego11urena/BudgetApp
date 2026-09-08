import { describe, it, expect } from "vitest";
import {
  computeSparklineSeries,
  computeSpendComparison,
  classifyGoalRowsForSummary,
  computeUncategorizedWarning,
} from "./summary";
import type { CycleFinancials, CycleTransactionSummary } from "./cycle-financials";
import type { GoalWithProgress } from "./goals";

describe("summary", () => {
  describe("computeSparklineSeries", () => {
    it("transforms cycles to sparkline points", () => {
      const cycles = [
        {
          periodLabel: "Aug 1-15",
          financials: { totalExpenses: 500 } as CycleFinancials,
        },
        {
          periodLabel: "Aug 16-31",
          financials: { totalExpenses: 594 } as CycleFinancials,
        },
      ];

      const result = computeSparklineSeries(cycles);

      expect(result).toEqual([
        { label: "Aug 1-15", spent: 500 },
        { label: "Aug 16-31", spent: 594 },
      ]);
    });

    it("handles empty list", () => {
      expect(computeSparklineSeries([])).toEqual([]);
    });
  });

  describe("computeSpendComparison", () => {
    it("returns null when fewer than 2 prior periods", () => {
      expect(computeSpendComparison(500, [])).toBeNull();
      expect(computeSpendComparison(500, [400])).toBeNull();
    });

    it("computes delta as lighter when below average", () => {
      const result = computeSpendComparison(500, [550, 600]); // avg = 575
      expect(result).toEqual({
        deltaAmount: 75, // 575 - 500
        isLighter: true,
        label: null,
        sinceLabel: null,
      });
    });

    it("computes delta as heavier when above average", () => {
      const result = computeSpendComparison(700, [550, 600]); // avg = 575
      expect(result).toEqual({
        deltaAmount: -125, // 575 - 700
        isLighter: false,
        label: null,
        sinceLabel: null,
      });
    });

    it("marks as lightest when below all historical", () => {
      const result = computeSpendComparison(400, [550, 600], [450, 500, 550, 600, 700]);
      expect(result?.label).toBe("lightest");
    });

    it("marks as heaviest when above all historical", () => {
      const result = computeSpendComparison(800, [550, 600], [450, 500, 550, 600, 700]);
      expect(result?.label).toBe("heaviest");
    });
  });

  describe("classifyGoalRowsForSummary", () => {
    it("marks goal as completed when savedSoFar >= target", () => {
      const goals: GoalWithProgress[] = [
        {
          categoryId: "cat1",
          name: "Vacation",
          icon: "🏖️",
          lifetimeTargetAmount: 1000,
          savedSoFar: 1200,
          currentCycleRecurringAmount: null,
        },
      ];

      const { completed, inProgress } = classifyGoalRowsForSummary(goals);

      expect(completed).toHaveLength(1);
      expect(inProgress).toHaveLength(0);
    });

    it("marks goal as in-progress when below target", () => {
      const goals: GoalWithProgress[] = [
        {
          categoryId: "cat1",
          name: "Vacation",
          icon: "🏖️",
          lifetimeTargetAmount: 1000,
          savedSoFar: 600,
          currentCycleRecurringAmount: null,
        },
      ];

      const { completed, inProgress } = classifyGoalRowsForSummary(goals);

      expect(completed).toHaveLength(0);
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].percentOfTarget).toBe(60);
    });

    it("ignores savings categories without a target (lifetimeTargetAmount === 0)", () => {
      const goals: GoalWithProgress[] = [
        {
          categoryId: "savings",
          name: "General Savings",
          icon: "💰",
          lifetimeTargetAmount: 0, // No target = not a goal
          savedSoFar: 500,
          currentCycleRecurringAmount: null,
        },
      ];

      const { completed, inProgress } = classifyGoalRowsForSummary(goals);

      expect(completed).toHaveLength(0);
      expect(inProgress).toHaveLength(0);
    });
  });

  describe("computeUncategorizedWarning", () => {
    it("returns null when no uncategorized expenses", () => {
      const financials: CycleFinancials = {
        totalExpenses: 500,
        transactions: [
          {
            id: "1",
            type: "EXPENSE",
            expenseCategoryId: "cat1",
            amount: 500,
          } as CycleTransactionSummary,
        ],
      } as CycleFinancials;

      expect(computeUncategorizedWarning(financials)).toBeNull();
    });

    it("returns count and sum of uncategorized expenses", () => {
      const financials: CycleFinancials = {
        totalExpenses: 500,
        transactions: [
          {
            id: "1",
            type: "EXPENSE",
            expenseCategoryId: null,
            amount: 250,
          } as CycleTransactionSummary,
          {
            id: "2",
            type: "EXPENSE",
            expenseCategoryId: null,
            amount: 150,
          } as CycleTransactionSummary,
          {
            id: "3",
            type: "EXPENSE",
            expenseCategoryId: "cat1",
            amount: 100,
          } as CycleTransactionSummary,
        ],
      } as CycleFinancials;

      const result = computeUncategorizedWarning(financials);

      expect(result).toEqual({ count: 2, totalAmount: 400 });
    });

    it("ignores INCOME and SAVINGS transactions", () => {
      const financials: CycleFinancials = {
        totalExpenses: 100,
        transactions: [
          {
            id: "1",
            type: "INCOME",
            expenseCategoryId: null,
            amount: 1000,
          } as CycleTransactionSummary,
          {
            id: "2",
            type: "SAVINGS",
            expenseCategoryId: null,
            amount: 200,
          } as CycleTransactionSummary,
          {
            id: "3",
            type: "EXPENSE",
            expenseCategoryId: null,
            amount: 100,
          } as CycleTransactionSummary,
        ],
      } as CycleFinancials;

      const result = computeUncategorizedWarning(financials);

      expect(result).toEqual({ count: 1, totalAmount: 100 });
    });
  });
});
