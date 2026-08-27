import { describe, expect, it } from "vitest";
import { generateInsights } from "./insights";
import { parseDateOnly } from "./pay-date";
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
      expect(insights).toEqual([
        { text: "You're spending at a sustainable pace to make it to your next payday." },
      ]);
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
        categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 200 }],
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
        categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 60 }],
      });
      const previous = [
        makeFinancials({ amountLeft: 50, categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 20 }] }),
        makeFinancials({ amountLeft: 50, categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 20 }] }),
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
        topCategories: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 200 }],
      });
      const previous = makeFinancials({
        categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 158 }],
      });
      const insights = generateInsights(current, [previous], makeExtras());
      expect(insights.some((i) => i.text === "Groceries spending is up $42.00 vs last cycle.")).toBe(true);
    });

    it("fallback still matches by categoryId across a rename, and never false-matches two categories sharing a name", () => {
      const renamed = generateInsights(
        makeFinancials({ topCategories: [{ categoryId: "c1", categoryName: "Food", categoryIcon: null, amount: 200 }] }),
        [makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 150 }] })],
        makeExtras(),
      );
      expect(renamed.some((i) => i.text === "Food spending is up $50.00 vs last cycle.")).toBe(true);

      const collision = generateInsights(
        makeFinancials({ topCategories: [{ categoryId: "c1", categoryName: "Travel", categoryIcon: null, amount: 200 }] }),
        [makeFinancials({ categoryTotals: [{ categoryId: "c2", categoryName: "Travel", categoryIcon: null, amount: 158 }] })],
        makeExtras(),
      );
      expect(collision.some((i) => i.text.includes("Travel spending is"))).toBe(false);
    });

    it("with 2+ closed cycles, flags the category with the largest RELATIVE deviation, not the largest absolute dollar amount", () => {
      const current = makeFinancials({
        categoryTotals: [
          { categoryId: "rent", categoryName: "Rent", categoryIcon: null, amount: 1000 },
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 60 },
        ],
      });
      const stableWindowCycle = makeFinancials({
        categoryTotals: [
          { categoryId: "rent", categoryName: "Rent", categoryIcon: null, amount: 1000 },
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 20 },
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
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 119 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
        ],
        makeExtras(),
      );
      expect(belowThreshold.some((i) => i.text.includes("Groceries"))).toBe(false);

      const atThreshold = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 120 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
        ],
        makeExtras(),
      );
      expect(atThreshold.some((i) => i.text.includes("Groceries"))).toBe(true);
    });
  });

  describe("pace-aware on-track rule", () => {
    // 15-day quincena (Aug 3-17, 2026); `now` = Aug 10 -> 8 of 15 days
    // elapsed, 7 remaining.
    const cycle = { periodStart: new Date(2026, 7, 3), periodEnd: null };
    const now = new Date(2026, 7, 10);

    it("gives a plain, non-repeating reassurance when the current daily rate would comfortably last the rest of the cycle", () => {
      // $400 spent over 8 days = $50/day; at that rate $600 left lasts 12
      // more days, well past the 7 remaining -- never at risk.
      const insights = generateInsights(
        makeFinancials({ baseIncome: 1000, extraIncome: 0, totalExpenses: 400, amountLeft: 600 }),
        [],
        makeExtras({ cycle, now }),
      );
      expect(
        insights.some((i) => i.text === "You're spending at a sustainable pace to make it to your next payday."),
      ).toBe(true);
    });

    it("projects a concrete run-out date once the current daily rate would exhaust the remaining balance before the cycle ends", () => {
      // $700 spent over 8 days = $87.50/day; at that rate $300 left lasts
      // ~3.43 more days (Aug 10 + 3 = Aug 13), 4 days short of the 7 remaining.
      const insights = generateInsights(
        makeFinancials({ baseIncome: 1000, extraIncome: 0, totalExpenses: 700, amountLeft: 300 }),
        [],
        makeExtras({ cycle, now }),
      );
      expect(
        insights.some(
          (i) =>
            i.text ===
            "At your current pace you'll run out of cash around Aug 13, 2026 — 4 days before your next payday.",
        ),
      ).toBe(true);
      expect(insights.some((i) => i.text.includes("sustainable pace"))).toBe(false);
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

  describe("category anomaly rule only fires on an increase, never a decrease", () => {
    it("produces no candidate when a category is spending LESS than its recent average", () => {
      const current = makeFinancials({
        categoryTotals: [
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 10 },
        ],
      });
      const stableWindowCycle = makeFinancials({
        categoryTotals: [
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 50 },
        ],
      });
      const insights = generateInsights(current, [stableWindowCycle, stableWindowCycle], makeExtras());
      expect(insights.some((i) => i.text.includes("Coffee"))).toBe(false);
    });

    it("the single-cycle fallback also produces no candidate for a decrease", () => {
      const insights = generateInsights(
        makeFinancials({ topCategories: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
        [makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 158 }] })],
        makeExtras(),
      );
      expect(insights.some((i) => i.text.includes("Groceries"))).toBe(false);
    });
  });

  describe("due-soon rule (MONTHLY recurring expense due day)", () => {
    // parseDateOnly (not a raw `new Date(y, m, d)`) for every `now` here --
    // dueSoonCandidate re-derives a Panama-anchored date purely from
    // dueDay/panamaDateParts(now), which (unlike the pure-difference math
    // calendarDaysBetween uses elsewhere in this file) has no built-in
    // cancellation of a non-Panama-anchored `now`'s own timezone offset.
    const aug3 = parseDateOnly("2026-08-03")!;
    const aug5 = parseDateOnly("2026-08-05")!;

    it("produces no candidate for a BIWEEKLY expense, even with a dueDay set", () => {
      const categories = [
        makeRecurringCategory([{ actual: 0, targetAmount: 650, frequency: "BIWEEKLY", dueDay: 5 }]),
      ];
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: aug3 }),
      );
      expect(insights.some((i) => i.text.includes("due"))).toBe(false);
    });

    it("produces no candidate once the expense is already paid", () => {
      const categories = [
        makeRecurringCategory([{ actual: 650, targetAmount: 650, frequency: "MONTHLY", dueDay: 5 }]),
      ];
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: aug3 }),
      );
      expect(insights.some((i) => i.text.includes("due"))).toBe(false);
    });

    it("names the expense, amount, and days-out for an unpaid MONTHLY expense due soon", () => {
      const categories = [
        makeRecurringCategory([{ name: "Rent", actual: 0, targetAmount: 650, frequency: "MONTHLY", dueDay: 5 }]),
      ];
      // now = Aug 3 -> Aug 5 due date is 2 days out.
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: aug3 }),
      );
      expect(insights.some((i) => i.text === "Rent ($650.00) due in 2 days and isn't marked paid.")).toBe(true);
    });

    it("still fires for an expense whose due day already passed, unpaid", () => {
      const categories = [
        makeRecurringCategory([{ name: "Rent", actual: 0, targetAmount: 650, frequency: "MONTHLY", dueDay: 3 }]),
      ];
      // now = Aug 5 -> Aug 3 due date was 2 days ago.
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: aug5 }),
      );
      expect(insights.some((i) => i.text === "Rent ($650.00) was due 2 days ago and isn't marked paid.")).toBe(true);
    });

    it("produces no candidate when the due day is further out than the due-soon window", () => {
      const categories = [
        makeRecurringCategory([{ name: "Rent", actual: 0, targetAmount: 650, frequency: "MONTHLY", dueDay: 20 }]),
      ];
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: aug3 }),
      );
      expect(insights.some((i) => i.text.includes("due"))).toBe(false);
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
