import { describe, it, expect } from "vitest";
import {
  computeSpendComparison,
  computeUncategorizedWarning,
} from "./summary";
import type { CycleFinancials, CycleTransactionSummary } from "./cycle-financials";

describe("summary", () => {
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
        sincePeriodStart: null,
      });
    });

    it("computes delta as heavier when above average", () => {
      const result = computeSpendComparison(700, [550, 600]); // avg = 575
      expect(result).toEqual({
        deltaAmount: -125, // 575 - 700
        isLighter: false,
        label: null,
        sincePeriodStart: null,
      });
    });

    it("marks as lightest when below all historical, naming that period's own periodStart", () => {
      const lightestStart = new Date("2026-03-01T05:00:00.000Z");
      const result = computeSpendComparison(400, [550, 600], [
        { amount: 450, periodStart: new Date("2026-01-01T05:00:00.000Z") },
        { amount: 500, periodStart: new Date("2026-02-01T05:00:00.000Z") },
        { amount: 550, periodStart: lightestStart },
        { amount: 600, periodStart: new Date("2026-04-01T05:00:00.000Z") },
        { amount: 700, periodStart: new Date("2026-05-01T05:00:00.000Z") },
      ]);
      expect(result?.label).toBe("lightest");
      // 400 is below every historical entry, so the "lightest" one on record is 450 -- not the current period.
      expect(result?.sincePeriodStart).toEqual(new Date("2026-01-01T05:00:00.000Z"));
    });

    it("marks as heaviest when above all historical, naming that period's own periodStart", () => {
      const result = computeSpendComparison(800, [550, 600], [
        { amount: 450, periodStart: new Date("2026-01-01T05:00:00.000Z") },
        { amount: 500, periodStart: new Date("2026-02-01T05:00:00.000Z") },
        { amount: 550, periodStart: new Date("2026-03-01T05:00:00.000Z") },
        { amount: 600, periodStart: new Date("2026-04-01T05:00:00.000Z") },
        { amount: 700, periodStart: new Date("2026-05-01T05:00:00.000Z") },
      ]);
      expect(result?.label).toBe("heaviest");
      expect(result?.sincePeriodStart).toEqual(new Date("2026-05-01T05:00:00.000Z"));
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
