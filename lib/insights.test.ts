import { describe, expect, it } from "vitest";
import { generateInsights } from "./insights";
import type { CycleFinancials } from "./cycle-financials";
import type { CategoryWithRecurringExpenses, RecurringExpenseWithStatus } from "./recurring-expenses";
import type { GoalWithProgress } from "./goals";

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

/** Day 1 of a 15-day quincena, by default -- pctElapsed is tiny and totalExpenses defaults to 0, so paceAwareCandidate never escalates unless a test deliberately sets otherwise. Matches the periodStart convention used throughout lib/cycles*.test.ts. */
function makeExtras(
  overrides: Partial<{
    cycle: { periodStart: Date; periodEnd: Date | null };
    recurringExpenseCategories: CategoryWithRecurringExpenses[];
    goals: GoalWithProgress[];
    now: Date;
  }> = {},
) {
  const periodStart = new Date(2026, 7, 3);
  return {
    cycle: { periodStart, periodEnd: null },
    recurringExpenseCategories: [],
    goals: [],
    now: periodStart,
    ...overrides,
  };
}

function makeRecurringCategory(
  expenses: Partial<RecurringExpenseWithStatus>[],
  overrides: Partial<CategoryWithRecurringExpenses> = {},
): CategoryWithRecurringExpenses {
  const built: RecurringExpenseWithStatus[] = expenses.map((e, i) => ({
    id: e.id ?? `re-${i}`,
    name: e.name ?? `Expense ${i}`,
    targetAmount: e.targetAmount ?? 20,
    actual: e.actual ?? 0,
    recurring: e.recurring ?? true,
    frequency: e.frequency ?? "BIWEEKLY",
    dueDay: e.dueDay ?? null,
    suggestedMatch: e.suggestedMatch ?? null,
  }));
  return {
    categoryId: "cat-recurring",
    categoryName: "Subscriptions",
    categoryIcon: null,
    targetAmount: built.reduce((sum, e) => sum + e.targetAmount, 0),
    actual: built.reduce((sum, e) => sum + e.actual, 0),
    expenses: built,
    ...overrides,
  };
}

function makeGoal(overrides: Partial<GoalWithProgress> = {}): GoalWithProgress {
  return {
    categoryId: "goal-1",
    name: "Emergency fund",
    icon: null,
    lifetimeTargetAmount: 1000,
    savedSoFar: 0,
    currentCycleRecurringAmount: null,
    ...overrides,
  };
}

describe("generateInsights", () => {
  describe("baseline on-track / over-budget / streak / no-history behavior", () => {
    // Regression anchor: generateInsights used to blanket-return [] whenever
    // there was no closed cycle history, hiding the Insights card entirely
    // for a first-time user -- even the on-track/over-budget rule, which
    // needs only the current cycle's own numbers and has nothing to do with
    // history. Only the genuinely comparative rules (category anomaly,
    // streak) should require history.
    it("still shows the on-track insight for a brand-new user with no closed cycles yet", () => {
      const insights = generateInsights(makeFinancials({ amountLeft: 2000 }), [], makeExtras());
      expect(insights).toEqual([{ text: "You're on track to have $2,000.00 left this cycle." }]);
    });

    it("still shows the over-budget insight for a brand-new user with no closed cycles yet", () => {
      const insights = generateInsights(
        makeFinancials({ amountLeft: -50, totalExpenses: 2050 }),
        [],
        makeExtras(),
      );
      expect(insights).toEqual([{ text: "You're $50.00 over budget this cycle so far." }]);
    });

    it("never reports a comparative category-anomaly or streak insight with no closed cycles", () => {
      const current = makeFinancials({
        amountLeft: 100,
        categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 200 }],
      });
      const insights = generateInsights(current, [], makeExtras());
      expect(insights.some((i) => i.text.includes("vs "))).toBe(false);
      expect(insights.some((i) => i.text.includes("cycles in a row"))).toBe(false);
    });

    it("reports an under-budget streak of 2 or more", () => {
      const previous = [
        makeFinancials({ amountLeft: 100 }),
        makeFinancials({ amountLeft: 50 }),
        makeFinancials({ amountLeft: -10 }),
      ];
      const insights = generateInsights(makeFinancials({ amountLeft: 200 }), previous, makeExtras());
      expect(insights.some((i) => i.text === "You've stayed under budget for 2 cycles in a row.")).toBe(true);
    });

    it("does not report a streak of only 1", () => {
      const previous = [makeFinancials({ amountLeft: -10 }), makeFinancials({ amountLeft: 100 })];
      const insights = generateInsights(makeFinancials({ amountLeft: 200 }), previous, makeExtras());
      expect(insights.some((i) => i.text.includes("cycles in a row"))).toBe(false);
    });
  });

  describe("priority-based top-3 selection", () => {
    it("picks the 3 highest-priority candidates when more than 3 apply, dropping the rest", () => {
      const current = makeFinancials({
        amountLeft: 320,
        totalExpenses: 0,
        categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, categoryColor: null, amount: 60 }],
      });
      const previous = [
        makeFinancials({ amountLeft: 50, categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, categoryColor: null, amount: 20 }] }),
        makeFinancials({ amountLeft: 50, categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, categoryColor: null, amount: 20 }] }),
      ];
      const extras = makeExtras({
        recurringExpenseCategories: [makeRecurringCategory([{ actual: 0, targetAmount: 20 }])],
        goals: [makeGoal({ savedSoFar: 850, lifetimeTargetAmount: 1000 })],
      });

      // 5 candidates apply here: unpaid-recurring (90), category-anomaly
      // (80), savings-goal (60), on-track (40), streak (35) -- top 3 by
      // priority should be unpaid-recurring, category-anomaly, savings-goal.
      const insights = generateInsights(current, previous, extras);
      expect(insights).toHaveLength(3);
      expect(insights[0].text).toContain("recurring expense");
      expect(insights[1].text).toContain("Coffee");
      expect(insights[2].text).toContain("Emergency fund");
      expect(insights.some((i) => i.text.includes("on track"))).toBe(false);
      expect(insights.some((i) => i.text.includes("cycles in a row"))).toBe(false);
    });
  });

  describe("unpaid recurring expenses rule", () => {
    it("produces no candidate when there are no recurring expenses at all", () => {
      const insights = generateInsights(makeFinancials(), [], makeExtras({ recurringExpenseCategories: [] }));
      expect(insights.some((i) => i.text.includes("recurring expense"))).toBe(false);
    });

    it("produces no candidate once everything is paid", () => {
      const categories = [makeRecurringCategory([{ actual: 20, targetAmount: 20 }])];
      const insights = generateInsights(makeFinancials(), [], makeExtras({ recurringExpenseCategories: categories }));
      expect(insights.some((i) => i.text.includes("recurring expense"))).toBe(false);
    });

    it("counts not-started and partial expenses, singular phrasing and remaining amount for exactly one", () => {
      const categories = [makeRecurringCategory([{ actual: 0, targetAmount: 20 }, { actual: 20, targetAmount: 20 }])];
      const insights = generateInsights(makeFinancials(), [], makeExtras({ recurringExpenseCategories: categories }));
      const match = insights.find((i) => i.text.includes("recurring expense"));
      expect(match?.text).toBe("1 recurring expense hasn't been paid yet this cycle ($20.00 left).");
      expect(match?.href).toBe("/budget");
    });

    it("pluralizes and sums remaining across multiple unpaid expenses, including a partial one", () => {
      const categories = [
        makeRecurringCategory([
          { id: "a", actual: 0, targetAmount: 20 },
          { id: "b", actual: 10, targetAmount: 25 },
          { id: "c", actual: 25, targetAmount: 25 },
        ]),
      ];
      const insights = generateInsights(makeFinancials(), [], makeExtras({ recurringExpenseCategories: categories }));
      const match = insights.find((i) => i.text.includes("recurring expenses"));
      // Unpaid: "a" (remaining 20) + "b" (remaining 15) = 35; "c" already paid.
      expect(match?.text).toBe("2 recurring expenses haven't been paid yet this cycle ($35.00 left).");
    });
  });

  describe("category anomaly rule (rolling average, with single-cycle fallback)", () => {
    it("falls back to a single-previous-cycle comparison with fewer than 2 closed cycles", () => {
      const current = makeFinancials({
        topCategories: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 200 }],
      });
      const previous = makeFinancials({
        categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 158 }],
      });
      const insights = generateInsights(current, [previous], makeExtras());
      expect(insights.some((i) => i.text === "Groceries spending is up $42.00 vs last cycle.")).toBe(true);
    });

    it("fallback still matches by categoryId across a rename, and never false-matches two categories sharing a name", () => {
      const renamed = generateInsights(
        makeFinancials({ topCategories: [{ categoryId: "c1", categoryName: "Food", categoryIcon: null, categoryColor: null, amount: 200 }] }),
        [makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 150 }] })],
        makeExtras(),
      );
      expect(renamed.some((i) => i.text === "Food spending is up $50.00 vs last cycle.")).toBe(true);

      const collision = generateInsights(
        makeFinancials({ topCategories: [{ categoryId: "c1", categoryName: "Travel", categoryIcon: null, categoryColor: null, amount: 200 }] }),
        [makeFinancials({ categoryTotals: [{ categoryId: "c2", categoryName: "Travel", categoryIcon: null, categoryColor: null, amount: 158 }] })],
        makeExtras(),
      );
      expect(collision.some((i) => i.text.includes("Travel spending is"))).toBe(false);
    });

    it("with 2+ closed cycles, flags the category with the largest RELATIVE deviation, not the largest absolute dollar amount", () => {
      const current = makeFinancials({
        categoryTotals: [
          { categoryId: "rent", categoryName: "Rent", categoryIcon: null, categoryColor: null, amount: 1000 },
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, categoryColor: null, amount: 60 },
        ],
      });
      const stableWindowCycle = makeFinancials({
        categoryTotals: [
          { categoryId: "rent", categoryName: "Rent", categoryIcon: null, categoryColor: null, amount: 1000 },
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, categoryColor: null, amount: 20 },
        ],
      });
      const insights = generateInsights(current, [stableWindowCycle, stableWindowCycle], makeExtras());
      const match = insights.find((i) => i.text.includes("vs your recent average"));
      expect(match?.text).toBe("Coffee spending is up $40.00 vs your recent average.");
      expect(match?.href).toBe("/transactions?category=coffee");
      expect(insights.some((i) => i.text.includes("Rent"))).toBe(false);
    });

    it("requires at least a 20% relative swing to fire", () => {
      const belowThreshold = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 119 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 100 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 100 }] }),
        ],
        makeExtras(),
      );
      expect(belowThreshold.some((i) => i.text.includes("Groceries"))).toBe(false);

      const atThreshold = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 120 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 100 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, categoryColor: null, amount: 100 }] }),
        ],
        makeExtras(),
      );
      expect(atThreshold.some((i) => i.text.includes("Groceries"))).toBe(true);
    });
  });

  describe("pace-aware on-track rule", () => {
    // 15-day quincena (Aug 3-17, 2026); `now` = Aug 10 -> 8 of 15 days
    // elapsed (53.3%). Both cases sit on either side of the 15-point gap
    // threshold against that same elapsed-% figure.
    const cycle = { periodStart: new Date(2026, 7, 3), periodEnd: null };
    const now = new Date(2026, 7, 10);

    it("keeps the plain on-track message when spend-pace is close to time-elapsed", () => {
      const insights = generateInsights(
        makeFinancials({ baseIncome: 1000, extraIncome: 0, totalExpenses: 680, amountLeft: 320 }),
        [],
        makeExtras({ cycle, now }),
      );
      expect(insights.some((i) => i.text === "You're on track to have $320.00 left this cycle.")).toBe(true);
    });

    it("escalates to a pacing-specific message once spend-pace runs 15+ points ahead of time-elapsed", () => {
      const insights = generateInsights(
        makeFinancials({ baseIncome: 1000, extraIncome: 0, totalExpenses: 700, amountLeft: 300 }),
        [],
        makeExtras({ cycle, now }),
      );
      expect(insights.some((i) => i.text === "You've used 70% of your budget with 47% of the cycle left.")).toBe(true);
      expect(insights.some((i) => i.text.startsWith("You're on track"))).toBe(false);
    });

    it("over-budget always takes the plain over-budget message, regardless of pace", () => {
      const insights = generateInsights(
        makeFinancials({ baseIncome: 1000, extraIncome: 0, totalExpenses: 1050, amountLeft: -50 }),
        [],
        makeExtras({ cycle, now }),
      );
      expect(insights.some((i) => i.text === "You're $50.00 over budget this cycle so far.")).toBe(true);
    });
  });

  describe("savings-goal proximity rule", () => {
    it("produces no candidate for a goal that's barely started", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ goals: [makeGoal({ savedSoFar: 50, lifetimeTargetAmount: 1000 })] }),
      );
      expect(insights.some((i) => i.text.includes("Emergency fund"))).toBe(false);
    });

    it("produces a candidate once progress is within 20% of the target", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ goals: [makeGoal({ savedSoFar: 850, lifetimeTargetAmount: 1000 })] }),
      );
      const match = insights.find((i) => i.text.includes("Emergency fund"));
      expect(match?.text).toBe("You're $150.00 away from hitting your Emergency fund target.");
      expect(match?.href).toBe("/goals");
    });

    it("skips a goal that's already complete", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ goals: [makeGoal({ savedSoFar: 1000, lifetimeTargetAmount: 1000 })] }),
      );
      expect(insights.some((i) => i.text.includes("Emergency fund"))).toBe(false);
    });

    it("with multiple qualifying goals, surfaces whichever is closest to its target", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({
          goals: [
            makeGoal({ name: "Vacation", savedSoFar: 810, lifetimeTargetAmount: 1000 }),
            makeGoal({ name: "New laptop", savedSoFar: 950, lifetimeTargetAmount: 1000 }),
          ],
        }),
      );
      expect(insights.some((i) => i.text.includes("New laptop"))).toBe(true);
      expect(insights.some((i) => i.text.includes("Vacation"))).toBe(false);
    });
  });
});
