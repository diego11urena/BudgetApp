import { describe, expect, it } from "vitest";
import { computeStreak, generateInsights } from "./insights";
import { parseDateOnly } from "./pay-date";
import type { CycleFinancials, CycleTransactionSummary } from "./cycle-financials";
import type { CategoryWithRecurringExpenses, RecurringExpenseWithStatus } from "./recurring-expenses";
import type { GoalWithProgress } from "./goals";
import type { Dictionary } from "./i18n/dictionary";
import { en } from "./i18n/dictionaries/en";

let nextTransactionId = 0;
function makeTransaction(overrides: Partial<CycleTransactionSummary> = {}): CycleTransactionSummary {
  nextTransactionId++;
  return {
    id: `tx-${nextTransactionId}`,
    cycleId: "cycle-1",
    type: "EXPENSE",
    name: "Some Merchant",
    amount: 10,
    categoryName: null,
    occurredAt: parseDateOnly("2026-08-03")!,
    isImported: false,
    importSource: "MANUAL",
    paymentMethod: null,
    description: null,
    expenseCategoryId: null,
    recurringExpenseId: null,
    ...overrides,
  };
}

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
    t: Dictionary["insights"];
  }> = {},
) {
  const periodStart = parseDateOnly("2026-08-03")!;
  return {
    cycle: { periodStart, periodEnd: null },
    recurringExpenseCategories: [],
    goals: [],
    now: periodStart,
    // English fixed here rather than parameterized -- these tests assert on
    // exact rendered strings (see every `expect(insights).toEqual([{ text:
    // "..." }])` below), so the dictionary itself is what's under test for
    // wiring correctness, not a thing that should vary per test run.
    t: en.insights,
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
    budgetTotal: built.reduce((sum, e) => sum + e.targetAmount, 0),
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
      expect(insights).toEqual([
        {
          text: "You're $50.00 over budget this cycle so far, with 14 days left.",
          severity: "critical",
        },
      ]);
    });

    it("never reports a comparative category-anomaly insight with no closed cycles", () => {
      const current = makeFinancials({
        amountLeft: 100,
        categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 200 }],
      });
      const insights = generateInsights(current, [], makeExtras());
      expect(insights.some((i) => i.text.includes("vs "))).toBe(false);
    });
  });

  // computeStreak moved out of generateInsights entirely -- it's no longer
  // a dashboard Insights candidate (see its own doc comment for why), just
  // a plain counting function CycleClosedCard's own data now calls
  // directly.
  describe("computeStreak", () => {
    it("counts consecutive (newest-first) under-budget cycles, stopping at the first over-budget one", () => {
      const previous = [
        makeFinancials({ amountLeft: 100 }),
        makeFinancials({ amountLeft: 50 }),
        makeFinancials({ amountLeft: -10 }),
        makeFinancials({ amountLeft: 200 }),
      ];
      expect(computeStreak(previous)).toBe(2);
    });

    it("returns 0 for an empty history", () => {
      expect(computeStreak([])).toBe(0);
    });

    it("returns 0 when the most recent cycle was over budget", () => {
      expect(computeStreak([makeFinancials({ amountLeft: -10 }), makeFinancials({ amountLeft: 100 })])).toBe(0);
    });
  });

  describe("priority-based top-2 selection", () => {
    it("picks the 2 highest-priority candidates when more apply, dropping the rest", () => {
      const current = makeFinancials({
        amountLeft: 320,
        totalExpenses: 0,
        categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 60 }],
      });
      const previous = [
        makeFinancials({ amountLeft: 50, categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 30 }] }),
        makeFinancials({ amountLeft: 50, categoryTotals: [{ categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 30 }] }),
      ];
      // now = the cycle's own last day, so the category-anomaly rule's
      // proration is a no-op here (percentElapsed = 1) and the fixture's
      // dollar amounts read the same as a full-cycle comparison; also past
      // the unpaid-recurring rule's 50%-elapsed gate.
      const extras = makeExtras({
        cycle: { periodStart: parseDateOnly("2026-08-03")!, periodEnd: null },
        now: parseDateOnly("2026-08-17")!,
        recurringExpenseCategories: [makeRecurringCategory([{ actual: 0, targetAmount: 20 }])],
        goals: [makeGoal({ savedSoFar: 850, lifetimeTargetAmount: 1000 })],
      });

      // 4 candidates apply here: unpaid-recurring (90), category-anomaly
      // (80), savings-goal (60), on-track (40) -- capped at 2, so only
      // unpaid-recurring and category-anomaly win a slot.
      const insights = generateInsights(current, previous, extras);
      expect(insights).toHaveLength(2);
      expect(insights[0].text).toContain("recurring expense");
      expect(insights[1].text).toBe("Coffee spending is up $30.00 vs your recent average.");
      expect(insights.some((i) => i.text.includes("Emergency fund"))).toBe(false);
      expect(insights.some((i) => i.text.includes("on track"))).toBe(false);
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

    it("does not fire before half the cycle has elapsed", () => {
      // makeExtras() defaults to day 1 of a 15-day quincena -- everything
      // is "unpaid" on day 1 by definition, so this rule should stay quiet.
      const categories = [makeRecurringCategory([{ actual: 0, targetAmount: 20 }])];
      const insights = generateInsights(makeFinancials(), [], makeExtras({ recurringExpenseCategories: categories }));
      expect(insights.some((i) => i.text.includes("recurring expense"))).toBe(false);
    });

    it("fires before the 50% mark anyway when a specific MONTHLY bill's own due day already passed", () => {
      const categories = [
        makeRecurringCategory([{ actual: 0, targetAmount: 650, frequency: "MONTHLY", dueDay: 1 }]),
      ];
      // now = Aug 3, day 1 of the cycle (well under 50% elapsed) -- but
      // dueDay 1 already passed relative to Aug 3.
      const insights = generateInsights(makeFinancials(), [], makeExtras({ recurringExpenseCategories: categories }));
      expect(insights.some((i) => i.text.includes("recurring expense hasn't"))).toBe(true);
    });

    it("counts not-started and partial expenses, singular phrasing and remaining amount for exactly one", () => {
      const categories = [makeRecurringCategory([{ actual: 0, targetAmount: 20 }, { actual: 20, targetAmount: 20 }])];
      // Past the rule's 50%-elapsed gate -- see "does not fire before half
      // the cycle has elapsed" below for the gate itself.
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: parseDateOnly("2026-08-17")! }),
      );
      const match = insights.find((i) => i.text.includes("recurring expense"));
      expect(match?.text).toBe("1 recurring expense hasn't been paid yet this cycle ($20.00 left).");
      expect(match?.href).toBe("/plan");
    });

    it("pluralizes and sums remaining across multiple unpaid expenses, including a partial one", () => {
      const categories = [
        makeRecurringCategory([
          { id: "a", actual: 0, targetAmount: 20 },
          { id: "b", actual: 10, targetAmount: 25 },
          { id: "c", actual: 25, targetAmount: 25 },
        ]),
      ];
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ recurringExpenseCategories: categories, now: parseDateOnly("2026-08-17")! }),
      );
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
          { categoryId: "coffee", categoryName: "Coffee", categoryIcon: null, amount: 30 },
        ],
      });
      // now = the cycle's own last day, so proration is a no-op and the
      // fixture's dollar amounts read the same as a full-cycle comparison.
      const insights = generateInsights(
        current,
        [stableWindowCycle, stableWindowCycle],
        makeExtras({ now: parseDateOnly("2026-08-17")! }),
      );
      const match = insights.find((i) => i.text.includes("vs your recent average"));
      expect(match?.text).toBe("Coffee spending is up $30.00 vs your recent average.");
      expect(match?.href).toBe("/transactions?category=coffee");
      expect(insights.some((i) => i.text.includes("Rent"))).toBe(false);
    });

    it("requires at least a 20% relative swing to fire", () => {
      // now = the cycle's own last day -- see the test above for why.
      const extras = makeExtras({ now: parseDateOnly("2026-08-17")! });
      const belowThreshold = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 119 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
        ],
        extras,
      );
      expect(belowThreshold.some((i) => i.text.includes("Groceries"))).toBe(false);

      const atThreshold = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 120 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Groceries", categoryIcon: null, amount: 100 }] }),
        ],
        extras,
      );
      expect(atThreshold.some((i) => i.text.includes("Groceries"))).toBe(true);
    });

    it("ignores a category averaging below the minimum-average floor, even with a large relative swing", () => {
      const insights = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "tiny", categoryName: "Parking", categoryIcon: null, amount: 10 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "tiny", categoryName: "Parking", categoryIcon: null, amount: 2 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "tiny", categoryName: "Parking", categoryIcon: null, amount: 2 }] }),
        ],
        makeExtras({ now: parseDateOnly("2026-08-17")! }),
      );
      expect(insights.some((i) => i.text.includes("Parking"))).toBe(false);
    });

    it("ignores a dollar delta below the minimum-dollar-delta floor, even with a large relative swing", () => {
      const insights = generateInsights(
        makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Snacks", categoryIcon: null, amount: 35 }] }),
        [
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Snacks", categoryIcon: null, amount: 25 }] }),
          makeFinancials({ categoryTotals: [{ categoryId: "c1", categoryName: "Snacks", categoryIcon: null, amount: 25 }] }),
        ],
        makeExtras({ now: parseDateOnly("2026-08-17")! }),
      );
      // average 25 (clears ANOMALY_MIN_AVERAGE), delta 10 (under ANOMALY_MIN_DOLLAR_DELTA of 15), 40% relative.
      expect(insights.some((i) => i.text.includes("Snacks"))).toBe(false);
    });
  });

  describe("pace-aware on-track rule", () => {
    // 15-day quincena (Aug 3-17, 2026); `now` = Aug 10 -> 8 of 15 days
    // elapsed, 7 remaining. parseDateOnly (Panama-anchored), not a raw
    // `new Date(y, m, d)` -- paceAwareCandidate's run-out projection feeds
    // `now` through addDays (Panama-anchored, see lib/pay-date.ts), so a
    // local-timezone-constructed `now` disagrees with it under any test
    // runner outside UTC-5/no-DST, e.g. CI's UTC runner.
    const cycle = { periodStart: parseDateOnly("2026-08-03")!, periodEnd: null };
    const now = parseDateOnly("2026-08-10")!;

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
      expect(
        insights.some((i) => i.text === "You're $50.00 over budget this cycle so far, with 7 days left."),
      ).toBe(true);
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
      expect(match?.href).toBe("/plan");
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

    it("fires at the new, lower 60% proximity threshold (would not have fired at the old 80%)", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ goals: [makeGoal({ savedSoFar: 650, lifetimeTargetAmount: 1000 })] }),
      );
      expect(insights.some((i) => i.text.includes("Emergency fund"))).toBe(true);
    });
  });

  describe("pace-aware rule links to Breakdown once it escalates", () => {
    it("the run-out-of-cash warning links to /dashboard/breakdown", () => {
      const cycle = { periodStart: parseDateOnly("2026-08-03")!, periodEnd: null };
      const now = parseDateOnly("2026-08-10")!;
      const insights = generateInsights(
        makeFinancials({ baseIncome: 1000, extraIncome: 0, totalExpenses: 700, amountLeft: 300 }),
        [],
        makeExtras({ cycle, now }),
      );
      const match = insights.find((i) => i.text.includes("run out of cash"));
      expect(match?.href).toBe("/dashboard/breakdown");
    });
  });

  describe("goal contribution rule (N2 -- planned vs. actually logged this cycle)", () => {
    it("does not fire before 60% of the cycle has elapsed", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({ goals: [makeGoal({ currentCycleRecurringAmount: 200 })] }),
      );
      expect(insights.some((i) => i.text.includes("planned"))).toBe(false);
    });

    it("fires once 60%+ elapsed with nothing logged toward a planned contribution", () => {
      const current = makeFinancials();
      const insights = generateInsights(
        current,
        [],
        makeExtras({
          now: parseDateOnly("2026-08-13")!, // day 11 of 15 -> ~73% elapsed
          goals: [makeGoal({ currentCycleRecurringAmount: 200 })],
        }),
      );
      const match = insights.find((i) => i.text.includes("planned"));
      expect(match?.text).toBe(
        "You planned $200.00 for Emergency fund this quincena — only $0.00 logged so far, with 4 days left.",
      );
      expect(match?.href).toBe("/plan");
    });

    it("does not fire once at least half the planned amount is actually logged this cycle", () => {
      const current = makeFinancials({
        transactions: [
          makeTransaction({ type: "SAVINGS", expenseCategoryId: "goal-1", amount: 100 }),
        ],
      });
      const insights = generateInsights(
        current,
        [],
        makeExtras({
          now: parseDateOnly("2026-08-13")!,
          goals: [makeGoal({ currentCycleRecurringAmount: 200 })],
        }),
      );
      expect(insights.some((i) => i.text.includes("planned"))).toBe(false);
    });

    it("ignores a goal with no per-cycle plan set", () => {
      const insights = generateInsights(
        makeFinancials(),
        [],
        makeExtras({
          now: parseDateOnly("2026-08-13")!,
          goals: [makeGoal({ currentCycleRecurringAmount: null })],
        }),
      );
      expect(insights.some((i) => i.text.includes("planned"))).toBe(false);
    });
  });

  describe("duplicate-charge rule (N6)", () => {
    it("flags two same-merchant, same-amount Gmail imports within 3 days of each other", () => {
      const current = makeFinancials({
        transactions: [
          makeTransaction({
            name: "Super 99",
            amount: 28.5,
            importSource: "GMAIL",
            occurredAt: parseDateOnly("2026-08-08")!,
          }),
          makeTransaction({
            name: "Super 99",
            amount: 28.5,
            importSource: "GMAIL",
            occurredAt: parseDateOnly("2026-08-09")!,
          }),
        ],
      });
      const insights = generateInsights(current, [], makeExtras());
      const match = insights.find((i) => i.text.includes("duplicate"));
      expect(match?.text).toBe("Two charges of $28.50 from Super 99 on Aug 9, 2026 — duplicate?");
      expect(match?.href).toBe(`/transactions?q=${encodeURIComponent("Super 99")}`);
    });

    it("does not flag two manual entries, even matching on name/amount/date", () => {
      const current = makeFinancials({
        transactions: [
          makeTransaction({ name: "Super 99", amount: 28.5, importSource: "MANUAL" }),
          makeTransaction({ name: "Super 99", amount: 28.5, importSource: "MANUAL" }),
        ],
      });
      const insights = generateInsights(current, [], makeExtras());
      expect(insights.some((i) => i.text.includes("duplicate"))).toBe(false);
    });

    it("does not flag a Gmail/manual pair -- both sides must be Gmail imports", () => {
      const current = makeFinancials({
        transactions: [
          makeTransaction({ name: "Super 99", amount: 28.5, importSource: "GMAIL" }),
          makeTransaction({ name: "Super 99", amount: 28.5, importSource: "MANUAL" }),
        ],
      });
      const insights = generateInsights(current, [], makeExtras());
      expect(insights.some((i) => i.text.includes("duplicate"))).toBe(false);
    });

    it("does not flag two Gmail charges more than 3 days apart", () => {
      const current = makeFinancials({
        transactions: [
          makeTransaction({
            name: "Super 99",
            amount: 28.5,
            importSource: "GMAIL",
            occurredAt: parseDateOnly("2026-08-01")!,
          }),
          makeTransaction({
            name: "Super 99",
            amount: 28.5,
            importSource: "GMAIL",
            occurredAt: parseDateOnly("2026-08-09")!,
          }),
        ],
      });
      const insights = generateInsights(current, [], makeExtras());
      expect(insights.some((i) => i.text.includes("duplicate"))).toBe(false);
    });

    it("does not flag two different amounts from the same Gmail merchant", () => {
      const current = makeFinancials({
        transactions: [
          makeTransaction({ name: "Super 99", amount: 28.5, importSource: "GMAIL" }),
          makeTransaction({ name: "Super 99", amount: 15.0, importSource: "GMAIL" }),
        ],
      });
      const insights = generateInsights(current, [], makeExtras());
      expect(insights.some((i) => i.text.includes("duplicate"))).toBe(false);
    });
  });
});
