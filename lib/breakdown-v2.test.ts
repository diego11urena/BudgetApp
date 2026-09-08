import { describe, it, expect } from "vitest";
import {
  classifyTransaction,
  computeDailySpendBuckets,
  computeHeatmapPercentileBuckets,
  pickDefaultSelectedDay,
  computeTransactionsForDay,
  computeTrendSeries,
  computeFixedShareTrend,
  computeCategoryRollingAverage,
  computeLiveBanner,
} from "./breakdown-v2";
import type { CycleTransactionSummary, CycleFinancials } from "./cycle-financials";

describe("breakdown-v2", () => {
  describe("classifyTransaction", () => {
    it("classifies SAVINGS as goals", () => {
      const tx: CycleTransactionSummary = {
        type: "SAVINGS",
        recurringExpenseId: null,
      } as CycleTransactionSummary;

      expect(classifyTransaction(tx)).toBe("goals");
    });

    it("classifies EXPENSE with recurringExpenseId as fixed", () => {
      const tx: CycleTransactionSummary = {
        type: "EXPENSE",
        recurringExpenseId: "recurring-1",
      } as CycleTransactionSummary;

      expect(classifyTransaction(tx)).toBe("fixed");
    });

    it("classifies EXPENSE without recurringExpenseId as discretionary", () => {
      const tx: CycleTransactionSummary = {
        type: "EXPENSE",
        recurringExpenseId: null,
      } as CycleTransactionSummary;

      expect(classifyTransaction(tx)).toBe("discretionary");
    });

    it("classifies INCOME as discretionary (fallback)", () => {
      const tx: CycleTransactionSummary = {
        type: "INCOME",
        recurringExpenseId: null,
      } as CycleTransactionSummary;

      expect(classifyTransaction(tx)).toBe("discretionary");
    });
  });

  describe("computeDailySpendBuckets", () => {
    it("sums EXPENSE transactions by date", () => {
      const start = new Date("2026-08-01");
      const end = new Date("2026-08-03");

      const transactions: CycleTransactionSummary[] = [
        {
          type: "EXPENSE",
          amount: 100,
          occurredAt: new Date("2026-08-01T10:00:00"),
        } as CycleTransactionSummary,
        {
          type: "EXPENSE",
          amount: 50,
          occurredAt: new Date("2026-08-01T14:00:00"),
        } as CycleTransactionSummary,
        {
          type: "EXPENSE",
          amount: 75,
          occurredAt: new Date("2026-08-02T10:00:00"),
        } as CycleTransactionSummary,
      ];

      const result = computeDailySpendBuckets(transactions, start, end);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: new Date("2026-08-01"), total: 150 });
      expect(result[1]).toEqual({ date: new Date("2026-08-02"), total: 75 });
      expect(result[2]).toEqual({ date: new Date("2026-08-03"), total: 0 });
    });

    it("ignores non-EXPENSE transactions", () => {
      const start = new Date("2026-08-01");
      const end = new Date("2026-08-02");

      const transactions: CycleTransactionSummary[] = [
        {
          type: "INCOME",
          amount: 1000,
          occurredAt: new Date("2026-08-01T10:00:00"),
        } as CycleTransactionSummary,
        {
          type: "SAVINGS",
          amount: 100,
          occurredAt: new Date("2026-08-01T11:00:00"),
        } as CycleTransactionSummary,
        {
          type: "EXPENSE",
          amount: 50,
          occurredAt: new Date("2026-08-01T12:00:00"),
        } as CycleTransactionSummary,
      ];

      const result = computeDailySpendBuckets(transactions, start, end);

      expect(result[0].total).toBe(50);
    });
  });

  describe("computeHeatmapPercentileBuckets", () => {
    it("assigns zero-spend days to bucket 0", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01"), total: 0 },
        { date: new Date("2026-08-02"), total: 0 },
      ];

      const result = computeHeatmapPercentileBuckets(dailyTotals);

      expect(result.get("2026-08-01")).toBe(0);
      expect(result.get("2026-08-02")).toBe(0);
    });

    it("splits non-zero days into buckets 1-4 via percentiles", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01"), total: 10 },
        { date: new Date("2026-08-02"), total: 25 },
        { date: new Date("2026-08-03"), total: 35 },
        { date: new Date("2026-08-04"), total: 50 },
        { date: new Date("2026-08-05"), total: 0 },
      ];

      const result = computeHeatmapPercentileBuckets(dailyTotals);

      // Non-zero sorted: [10, 25, 35, 50]
      // p25 @ index 1 = 25, p50 @ index 2 = 35, p75 @ index 3 = 50
      // 10 <= p25 → bucket 1
      // 25 <= p25 → bucket 1
      // 35 <= p50 → bucket 2
      // 50 <= p75 → bucket 3
      expect(result.get("2026-08-01")).toBe(1);
      expect(result.get("2026-08-02")).toBe(1);
      expect(result.get("2026-08-03")).toBe(2);
      expect(result.get("2026-08-04")).toBe(3);
      expect(result.get("2026-08-05")).toBe(0);
    });
  });

  describe("pickDefaultSelectedDay", () => {
    it("returns highest-spend day", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01"), total: 100 },
        { date: new Date("2026-08-02"), total: 300 },
        { date: new Date("2026-08-03"), total: 200 },
      ];

      const result = pickDefaultSelectedDay(dailyTotals);

      expect(result?.toISOString().split("T")[0]).toBe("2026-08-02");
    });

    it("returns null when all days are zero", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01"), total: 0 },
        { date: new Date("2026-08-02"), total: 0 },
      ];

      expect(pickDefaultSelectedDay(dailyTotals)).toBeNull();
    });

    it("ignores zero-spend days", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01"), total: 0 },
        { date: new Date("2026-08-02"), total: 100 },
        { date: new Date("2026-08-03"), total: 0 },
      ];

      const result = pickDefaultSelectedDay(dailyTotals);

      expect(result?.toISOString().split("T")[0]).toBe("2026-08-02");
    });
  });

  describe("computeTransactionsForDay", () => {
    it("filters to a specific calendar day", () => {
      const transactions: CycleTransactionSummary[] = [
        {
          id: "1",
          occurredAt: new Date("2026-08-01T10:00:00"),
        } as CycleTransactionSummary,
        {
          id: "2",
          occurredAt: new Date("2026-08-01T15:00:00"),
        } as CycleTransactionSummary,
        {
          id: "3",
          occurredAt: new Date("2026-08-02T10:00:00"),
        } as CycleTransactionSummary,
      ];

      const result = computeTransactionsForDay(transactions, new Date("2026-08-01"));

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
    });
  });

  describe("computeTrendSeries", () => {
    it("splits spend by fixed vs discretionary", () => {
      const cycles = [
        {
          periodLabel: "Period 1",
          financials: {
            transactions: [
              {
                type: "EXPENSE",
                amount: 100,
                recurringExpenseId: "rec-1",
              } as CycleTransactionSummary,
              {
                type: "EXPENSE",
                amount: 50,
                recurringExpenseId: null,
              } as CycleTransactionSummary,
            ],
          } as CycleFinancials,
        },
      ];

      const result = computeTrendSeries(cycles);

      expect(result[0]).toEqual({
        label: "Period 1",
        bills: 100,
        discretionary: 50,
      });
    });
  });

  describe("computeFixedShareTrend", () => {
    it("computes bills % over multiple periods", () => {
      const cycles = [
        {
          financials: {
            transactions: [
              {
                type: "EXPENSE",
                amount: 50,
                recurringExpenseId: "rec-1",
              } as CycleTransactionSummary,
              {
                type: "EXPENSE",
                amount: 50,
                recurringExpenseId: null,
              } as CycleTransactionSummary,
            ],
          } as CycleFinancials,
        },
        {
          financials: {
            transactions: [
              {
                type: "EXPENSE",
                amount: 60,
                recurringExpenseId: "rec-1",
              } as CycleTransactionSummary,
              {
                type: "EXPENSE",
                amount: 40,
                recurringExpenseId: null,
              } as CycleTransactionSummary,
            ],
          } as CycleFinancials,
        },
      ];

      const result = computeFixedShareTrend(cycles);

      expect(result.periods[0].billsPct).toBe(50);
      expect(result.periods[1].billsPct).toBe(60);
      expect(result.oldPct).toBe(50);
      expect(result.newPct).toBe(60);
      expect(result.direction).toBe("rising");
    });

    it("marks as holding steady when delta < 1.5pt", () => {
      const cycles = [
        {
          financials: {
            transactions: [
              {
                type: "EXPENSE",
                amount: 50,
                recurringExpenseId: "rec-1",
              } as CycleTransactionSummary,
              {
                type: "EXPENSE",
                amount: 50,
                recurringExpenseId: null,
              } as CycleTransactionSummary,
            ],
          } as CycleFinancials,
        },
        {
          financials: {
            transactions: [
              {
                type: "EXPENSE",
                amount: 51,
                recurringExpenseId: "rec-1",
              } as CycleTransactionSummary,
              {
                type: "EXPENSE",
                amount: 49,
                recurringExpenseId: null,
              } as CycleTransactionSummary,
            ],
          } as CycleFinancials,
        },
      ];

      const result = computeFixedShareTrend(cycles);

      expect(result.direction).toBe("holding steady");
    });
  });

  describe("computeCategoryRollingAverage", () => {
    it("averages a category across trailing cycles", () => {
      const cycles = [
        {
          financials: {
            categoryTotals: [{ categoryId: "groceries", amount: 100 }],
          } as CycleFinancials,
        },
        {
          financials: {
            categoryTotals: [{ categoryId: "groceries", amount: 200 }],
          } as CycleFinancials,
        },
      ];

      const result = computeCategoryRollingAverage("groceries", cycles, 2);

      expect(result).toBe(150);
    });

    it("returns 0 for categories with no data", () => {
      const cycles = [
        {
          financials: {
            categoryTotals: [{ categoryId: "groceries", amount: 100 }],
          } as CycleFinancials,
        },
      ];

      const result = computeCategoryRollingAverage("utilities", cycles, 1);

      expect(result).toBe(0);
    });
  });

  describe("computeLiveBanner", () => {
    it("computes projected spend from pace", () => {
      const result = computeLiveBanner(500, 10, 30);

      expect(result).toEqual({
        spent: 500,
        projected: 1500,
        dayIndex: 10,
        totalDays: 30,
      });
    });

    it("handles zero dayIndex", () => {
      const result = computeLiveBanner(500, 0, 30);

      expect(result.projected).toBe(0);
    });
  });
});
