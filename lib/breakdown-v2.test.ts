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
import { formatCycleLabel } from "./pay-date";
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
      const start = new Date("2026-08-01T05:00:00.000Z");
      const end = new Date("2026-08-03T05:00:00.000Z");

      const transactions: CycleTransactionSummary[] = [
        {
          type: "EXPENSE",
          amount: 100,
          occurredAt: new Date("2026-08-01T15:00:00.000Z"),
        } as CycleTransactionSummary,
        {
          type: "EXPENSE",
          amount: 50,
          occurredAt: new Date("2026-08-01T19:00:00.000Z"),
        } as CycleTransactionSummary,
        {
          type: "EXPENSE",
          amount: 75,
          occurredAt: new Date("2026-08-02T15:00:00.000Z"),
        } as CycleTransactionSummary,
      ];

      const result = computeDailySpendBuckets(transactions, start, end);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ date: new Date("2026-08-01T05:00:00.000Z"), total: 150 });
      expect(result[1]).toEqual({ date: new Date("2026-08-02T05:00:00.000Z"), total: 75 });
      expect(result[2]).toEqual({ date: new Date("2026-08-03T05:00:00.000Z"), total: 0 });
    });

    it("ignores non-EXPENSE transactions", () => {
      const start = new Date("2026-08-01T05:00:00.000Z");
      const end = new Date("2026-08-02T05:00:00.000Z");

      const transactions: CycleTransactionSummary[] = [
        {
          type: "INCOME",
          amount: 1000,
          occurredAt: new Date("2026-08-01T15:00:00.000Z"),
        } as CycleTransactionSummary,
        {
          type: "SAVINGS",
          amount: 100,
          occurredAt: new Date("2026-08-01T16:00:00.000Z"),
        } as CycleTransactionSummary,
        {
          type: "EXPENSE",
          amount: 50,
          occurredAt: new Date("2026-08-01T17:00:00.000Z"),
        } as CycleTransactionSummary,
      ];

      const result = computeDailySpendBuckets(transactions, start, end);

      expect(result[0].total).toBe(50);
    });
  });

  describe("computeHeatmapPercentileBuckets", () => {
    it("assigns zero-spend days to bucket 0", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 0 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 0 },
      ];

      const result = computeHeatmapPercentileBuckets(dailyTotals);

      expect(result.get("2026-08-01")).toBe(0);
      expect(result.get("2026-08-02")).toBe(0);
    });

    it("splits non-zero days into buckets 1-4 via percentiles", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 10 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 25 },
        { date: new Date("2026-08-03T05:00:00.000Z"), total: 35 },
        { date: new Date("2026-08-04T05:00:00.000Z"), total: 50 },
        { date: new Date("2026-08-05T05:00:00.000Z"), total: 0 },
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
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 100 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 300 },
        { date: new Date("2026-08-03T05:00:00.000Z"), total: 200 },
      ];

      const result = pickDefaultSelectedDay(dailyTotals);

      expect(result?.toISOString().split("T")[0]).toBe("2026-08-02");
    });

    it("returns null when all days are zero", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 0 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 0 },
      ];

      expect(pickDefaultSelectedDay(dailyTotals)).toBeNull();
    });

    it("ignores zero-spend days", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 0 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 100 },
        { date: new Date("2026-08-03T05:00:00.000Z"), total: 0 },
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
          occurredAt: new Date("2026-08-01T15:00:00.000Z"),
        } as CycleTransactionSummary,
        {
          id: "2",
          occurredAt: new Date("2026-08-01T20:00:00.000Z"),
        } as CycleTransactionSummary,
        {
          id: "3",
          occurredAt: new Date("2026-08-02T15:00:00.000Z"),
        } as CycleTransactionSummary,
      ];

      const result = computeTransactionsForDay(transactions, new Date("2026-08-01T05:00:00.000Z"));

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

describe("Panama calendar days (not UTC)", () => {
  // Panama is UTC-5 and never observes DST, so 19:00 Panama on the 10th is
  // already 00:00 UTC on the 11th. Bucketing on toISOString() puts that
  // purchase on the wrong heatmap cell -- the single thing chapter 01 is
  // about. Every assertion below fails if this file goes back to UTC days.
  const tx = (iso: string, amount: number): CycleTransactionSummary =>
    ({
      id: iso,
      type: "EXPENSE",
      name: "Test",
      amount,
      occurredAt: new Date(iso),
      expenseCategoryId: null,
      expenseCategoryName: null,
      expenseCategoryIcon: null,
      recurringExpenseId: null,
    }) as unknown as CycleTransactionSummary;

  it("counts a late-evening Panama purchase on the day it happened locally", () => {
    // 19:30 Panama on Aug 10 == 00:30 UTC Aug 11.
    const evening = tx("2026-08-11T00:30:00.000Z", 40);
    const days = computeDailySpendBuckets([evening], new Date("2026-08-10T05:00:00.000Z"), new Date("2026-08-12T05:00:00.000Z"));

    const aug10 = days.find((d) => formatCycleLabel(d.date) === "2026-08-10");
    const aug11 = days.find((d) => formatCycleLabel(d.date) === "2026-08-11");
    expect(aug10?.total).toBe(40);
    expect(aug11?.total).toBe(0);
  });

  it("walks a whole cycle without dropping or duplicating a day", () => {
    const days = computeDailySpendBuckets([], new Date("2026-08-01T05:00:00.000Z"), new Date("2026-08-15T05:00:00.000Z"));
    const labels = days.map((d) => formatCycleLabel(d.date));
    expect(labels).toHaveLength(15);
    expect(labels[0]).toBe("2026-08-01");
    expect(labels[14]).toBe("2026-08-15");
    expect(new Set(labels).size).toBe(15);
  });

  it("filters a day's transactions by the Panama date, not the UTC one", () => {
    const evening = tx("2026-08-11T00:30:00.000Z", 40);
    expect(computeTransactionsForDay([evening], new Date("2026-08-10T12:00:00.000Z"))).toHaveLength(1);
    expect(computeTransactionsForDay([evening], new Date("2026-08-11T12:00:00.000Z"))).toHaveLength(0);
  });

  it("keys heatmap buckets by the Panama day", () => {
    const evening = tx("2026-08-11T00:30:00.000Z", 40);
    const days = computeDailySpendBuckets([evening], new Date("2026-08-10T05:00:00.000Z"), new Date("2026-08-11T05:00:00.000Z"));
    const buckets = computeHeatmapPercentileBuckets(days);
    expect(buckets.get("2026-08-10")).toBeGreaterThan(0);
    expect(buckets.get("2026-08-11")).toBe(0);
  });
});
