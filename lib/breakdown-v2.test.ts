import { describe, it, expect } from "vitest";
import {
  classifyTransaction,
  computeBiggestTransactions,
  computeCashFlowBreakdown,
  computeDailySpendBuckets,
  computeHeatmapPercentileBuckets,
  pickDefaultSelectedDay,
  computeTransactionsForDay,
  computeCategoryRollingAverage,
  computeLiveBanner,
  computeWeekendShare,
} from "./breakdown-v2";
import { formatCycleLabel, panamaMidnight } from "./pay-date";
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

    it("classifies INCOME as its own category, not discretionary", () => {
      const tx: CycleTransactionSummary = {
        type: "INCOME",
        recurringExpenseId: null,
      } as CycleTransactionSummary;

      expect(classifyTransaction(tx)).toBe("income");
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
    it("CLOSED: returns the most recent day with spend, even when an earlier day spent more", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 300 }, // biggest, but not most recent
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 0 },
        { date: new Date("2026-08-03T05:00:00.000Z"), total: 100 }, // most recent with spend
      ];

      const result = pickDefaultSelectedDay(dailyTotals, "CLOSED", new Date("2026-08-05T00:00:00.000Z"));

      expect(result?.toISOString().split("T")[0]).toBe("2026-08-03");
    });

    it("CLOSED: returns null when the whole period is zero", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 0 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 0 },
      ];

      expect(pickDefaultSelectedDay(dailyTotals, "CLOSED", new Date("2026-08-05T00:00:00.000Z"))).toBeNull();
    });

    it("LIVE: always returns today, regardless of which day spent the most", () => {
      const dailyTotals = [
        { date: new Date("2026-08-01T05:00:00.000Z"), total: 300 },
        { date: new Date("2026-08-02T05:00:00.000Z"), total: 0 }, // today, $0 spent so far
      ];

      const result = pickDefaultSelectedDay(dailyTotals, "LIVE", new Date("2026-08-02T18:00:00.000Z"));

      expect(result?.toISOString().split("T")[0]).toBe("2026-08-02");
    });

    it("LIVE: returns null if today somehow isn't in dailyTotals", () => {
      const dailyTotals = [{ date: new Date("2026-08-01T05:00:00.000Z"), total: 100 }];

      expect(pickDefaultSelectedDay(dailyTotals, "LIVE", new Date("2026-09-01T00:00:00.000Z"))).toBeNull();
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

  describe("computeCashFlowBreakdown", () => {
    const financials = (overrides: Partial<CycleFinancials>): CycleFinancials =>
      ({
        baseIncome: 800,
        extraIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        amountLeft: 0,
        transactions: [],
        categoryTotals: [],
        topCategories: [],
        ...overrides,
      }) as CycleFinancials;

    it("holds the identity income = fixed + everythingElse + saved + leftover when not overspent", () => {
      const result = computeCashFlowBreakdown(
        financials({
          totalSavings: 100,
          transactions: [
            { type: "EXPENSE", amount: 150, recurringExpenseId: "rec-1", categoryName: "Rent" } as CycleTransactionSummary,
            { type: "EXPENSE", amount: 200, recurringExpenseId: null, categoryName: "Dining" } as CycleTransactionSummary,
            { type: "SAVINGS", amount: 100, recurringExpenseId: null, categoryName: "Emergency Fund" } as CycleTransactionSummary,
          ],
        }),
      );

      expect(result).toEqual({
        income: 800,
        fixed: 150,
        everythingElse: 200,
        saved: 100,
        savedGoals: ["Emergency Fund"],
        leftover: 350, // 800 - 150 - 200 - 100
      });
      expect(result.fixed + result.everythingElse + result.saved + result.leftover).toBe(result.income);
    });

    it("clamps leftover to 0 when overspent, rather than going negative -- the four parts then sum to MORE than income by design (spec: leftover clamped >= 0, not a negative Leftover)", () => {
      const result = computeCashFlowBreakdown(
        financials({
          totalSavings: 0,
          transactions: [{ type: "EXPENSE", amount: 900, recurringExpenseId: null, categoryName: "Dining" } as CycleTransactionSummary],
        }),
      );

      expect(result.leftover).toBe(0);
      expect(result.fixed + result.everythingElse + result.saved + result.leftover).toBeGreaterThan(result.income);
    });

    it("dedupes savedGoals in first-seen order", () => {
      const result = computeCashFlowBreakdown(
        financials({
          totalSavings: 150,
          transactions: [
            { type: "SAVINGS", amount: 50, recurringExpenseId: null, categoryName: "Japan trip" } as CycleTransactionSummary,
            { type: "SAVINGS", amount: 50, recurringExpenseId: null, categoryName: "Emergency Fund" } as CycleTransactionSummary,
            { type: "SAVINGS", amount: 50, recurringExpenseId: null, categoryName: "Japan trip" } as CycleTransactionSummary,
          ],
        }),
      );

      expect(result.savedGoals).toEqual(["Japan trip", "Emergency Fund"]);
    });

    it("never counts INCOME transactions as everythingElse (regression: extra income used to leak into spending via classifyTransaction's old discretionary fallback)", () => {
      const result = computeCashFlowBreakdown(
        financials({
          extraIncome: 200,
          totalSavings: 0,
          transactions: [
            { type: "INCOME", amount: 200, recurringExpenseId: null, categoryName: "Bonus" } as CycleTransactionSummary,
            { type: "EXPENSE", amount: 50, recurringExpenseId: null, categoryName: "Dining" } as CycleTransactionSummary,
          ],
        }),
      );

      expect(result.everythingElse).toBe(50);
      // Also never treated as a "goal" -- it shouldn't show up in the tappable Saved row's subline either.
      expect(result.savedGoals).toEqual([]);
    });
  });

  describe("computeBiggestTransactions", () => {
    const tx = (id: string, amount: number, opts: Partial<CycleTransactionSummary> = {}): CycleTransactionSummary =>
      ({
        id,
        name: id,
        amount,
        categoryName: null,
        occurredAt: new Date("2026-08-05T15:00:00.000Z"),
        type: "EXPENSE",
        recurringExpenseId: null,
        ...opts,
      }) as CycleTransactionSummary;

    it("excludes fixed (recurring-linked), SAVINGS, and INCOME transactions", () => {
      const result = computeBiggestTransactions([
        tx("rent", 500, { recurringExpenseId: "rec-1" }),
        tx("goal", 400, { type: "SAVINGS" }),
        // Regression: a paycheck/extra-income row is not "the biggest
        // transaction" even though it's this list's largest amount by
        // far -- classifyTransaction used to fall INCOME through to
        // "discretionary" here (see its own doc comment).
        tx("paycheck", 2000, { type: "INCOME" }),
        tx("dinner", 60),
      ]);

      expect(result.map((r) => r.id)).toEqual(["dinner"]);
    });

    it("sorts descending by amount and respects limit", () => {
      const result = computeBiggestTransactions(
        [tx("a", 10), tx("b", 50), tx("c", 30), tx("d", 40)],
        { limit: 2 },
      );

      expect(result.map((r) => r.id)).toEqual(["b", "d"]);
    });

    it("respects excludeDate", () => {
      const result = computeBiggestTransactions([
        tx("same-day", 500, { occurredAt: new Date("2026-08-05T20:00:00.000Z") }),
        tx("other-day", 60, { occurredAt: new Date("2026-08-06T15:00:00.000Z") }),
      ], { excludeDate: "2026-08-05" });

      expect(result.map((r) => r.id)).toEqual(["other-day"]);
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

describe("computeWeekendShare", () => {
  /**
   * Aug 2026: the 7th is a Friday, so 7/8/9 are Fri/Sat/Sun and 10/11 are
   * Mon/Tue. Dates are built through panamaMidnight so the weekday is the
   * Panama one, matching how the rest of this module anchors days.
   */
  const day = (d: number, total: number) => ({ date: panamaMidnight(2026, 8, d), total });

  it("counts Friday through Sunday as the weekend", () => {
    const result = computeWeekendShare([
      day(7, 30), // Fri
      day(8, 40), // Sat
      day(9, 30), // Sun
      day(10, 100), // Mon
    ]);
    expect(result).not.toBeNull();
    expect(result!.weekendTotal).toBe(100);
    expect(result!.periodTotal).toBe(200);
    expect(result!.share).toBeCloseTo(0.5, 5);
  });

  it("treats Friday as part of the weekend, not the week", () => {
    // The spec's line is "Fri-Sun", so a Friday-only period is 100%.
    const result = computeWeekendShare([day(7, 50), day(10, 0)]);
    expect(result!.share).toBe(1);
  });

  it("returns null when the period has no spend at all", () => {
    // 0 of 0 is not "0% at the weekend" -- it is nothing to say, and the
    // chapter renders its own empty state instead.
    expect(computeWeekendShare([day(7, 0), day(10, 0)])).toBeNull();
    expect(computeWeekendShare([])).toBeNull();
  });

  it("reports 0 when every dollar lands midweek", () => {
    const result = computeWeekendShare([day(10, 80), day(11, 20)]);
    expect(result!.share).toBe(0);
    expect(result!.weekendTotal).toBe(0);
    expect(result!.periodTotal).toBe(100);
  });

  it("rounds the reported totals to cents without distorting the share", () => {
    const result = computeWeekendShare([day(8, 33.333), day(10, 66.667)]);
    expect(result!.weekendTotal).toBe(33.33);
    expect(result!.periodTotal).toBe(100);
    expect(result!.share).toBeCloseTo(0.33333, 4);
  });
});
