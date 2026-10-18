import { describe, expect, it } from "vitest";
import { generateInsights, PRIORITY, type InsightExtras, type InsightMemoryRecord } from "./insights";
import { parseDateOnly } from "./pay-date";
import type { CategoryTotal, CycleFinancials, CycleTransactionSummary } from "./cycle-financials";
import type { CategoryWithRecurringExpenses, RecurringExpenseWithStatus } from "./recurring-expenses";
import type { GoalWithProgress } from "./goals";
import { en } from "./i18n/dictionaries/en";
import { getRecurringExpensePaymentStatus } from "./recurring-expense-status";

const day = (iso: string) => parseDateOnly(iso)!;

/** The default cycle: a 15-day quincena, Aug 3-17 2026. Day N of it is Aug (2+N). */
const CYCLE_START = day("2026-08-03");

let nextId = 0;
function tx(overrides: Partial<CycleTransactionSummary> = {}): CycleTransactionSummary {
  nextId++;
  return {
    id: `tx-${nextId}`,
    cycleId: "cycle-1",
    type: "EXPENSE",
    name: "Some Merchant",
    amount: 10,
    categoryName: null,
    occurredAt: CYCLE_START,
    isImported: false,
    importSource: "MANUAL",
    paymentMethod: null,
    description: null,
    expenseCategoryId: null,
    recurringExpenseId: null,
    ...overrides,
  };
}

/** Financials derived from the transactions, the way summarizeCycleFinancials would. */
function financials(transactions: CycleTransactionSummary[] = [], overrides: Partial<CycleFinancials> = {}): CycleFinancials {
  const baseIncome = overrides.baseIncome ?? 2000;
  const sum = (type: CycleTransactionSummary["type"]) =>
    transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const totals = new Map<string, CategoryTotal>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE" || !t.expenseCategoryId) continue;
    const existing = totals.get(t.expenseCategoryId);
    if (existing) existing.amount += t.amount;
    else totals.set(t.expenseCategoryId, { categoryId: t.expenseCategoryId, categoryName: t.categoryName ?? "Cat", categoryIcon: null, amount: t.amount });
  }
  const categoryTotals = [...totals.values()].sort((a, b) => b.amount - a.amount);
  return {
    baseIncome,
    paycheckCount: 1,
    extraIncome: sum("INCOME"),
    totalExpenses: sum("EXPENSE"),
    totalSavings: sum("SAVINGS"),
    amountLeft: baseIncome + sum("INCOME") - sum("EXPENSE") - sum("SAVINGS"),
    transactions,
    categoryTotals,
    topCategories: categoryTotals.slice(0, 6),
    ...overrides,
  };
}

function extras(overrides: Partial<InsightExtras> = {}): InsightExtras {
  return {
    cycleId: "cycle-1",
    cycle: { periodStart: CYCLE_START, periodEnd: null },
    recurringExpenseCategories: [],
    goals: [],
    budgetFrequency: "QUINCENAL",
    vocab: en.periodVocab.quincenal,
    now: CYCLE_START,
    t: en.insights,
    ...overrides,
  };
}

function recurring(expenses: Partial<RecurringExpenseWithStatus>[]): CategoryWithRecurringExpenses[] {
  const built = expenses.map((e, i) => {
    const targetAmount = e.targetAmount ?? 20;
    const actual = e.actual ?? 0;
    return {
      id: e.id ?? `re-${i}`,
      name: e.name ?? `Expense ${i}`,
      targetAmount,
      actual,
      recurring: true,
      dueDay: e.dueDay ?? null,
      chargedThisCycle: e.chargedThisCycle ?? true,
      status: e.status ?? getRecurringExpensePaymentStatus(actual, targetAmount),
      suggestedMatch: null,
    };
  });
  return [{ categoryId: "cat-r", categoryName: "Subscriptions", categoryIcon: null, budgetTotal: 0, actual: 0, expenses: built }];
}

function goal(overrides: Partial<GoalWithProgress> = {}): GoalWithProgress {
  return { categoryId: "goal-1", name: "Emergency fund", icon: null, lifetimeTargetAmount: 1000, savedSoFar: 0, currentCycleRecurringAmount: null, ...overrides };
}

/** The texts of the insights shown. */
function texts(current: CycleFinancials, previous: CycleFinancials[], ex: InsightExtras): string[] {
  return generateInsights(current, previous, ex).map((i) => i.text);
}

/** The insight matching `match` among the ones shown (tests keep other rules quiet so the one under test makes the top 2). */
function find(current: CycleFinancials, previous: CycleFinancials[], ex: InsightExtras, match: RegExp) {
  return generateInsights(current, previous, ex).find((i) => match.test(i.text));
}

describe("upcoming charges (heads-up)", () => {
  const now = day("2026-08-05");

  it("names a single charge coming up, with no 'marked paid' wording", () => {
    const ex = extras({ now, recurringExpenseCategories: recurring([{ name: "Spotify", targetAmount: 0.99, dueDay: 7 }]) });
    const insight = find(financials(), [], ex, /Spotify/)!;
    expect(insight.text).toBe("Spotify ($0.99) will be charged in 2 days.");
    expect(insight.href).toBe("/plan");
    expect(insight.severity).toBe("recurring");
  });

  it("says today and tomorrow", () => {
    const ex = (dueDay: number) => extras({ now, recurringExpenseCategories: recurring([{ name: "Gym", targetAmount: 30, dueDay }]) });
    expect(find(financials(), [], ex(5), /Gym/)!.text).toBe("Gym ($30.00) will be charged today.");
    expect(find(financials(), [], ex(6), /Gym/)!.text).toBe("Gym ($30.00) will be charged tomorrow.");
  });

  it("combines several charges in the next 3 days into one message", () => {
    const ex = extras({
      now,
      recurringExpenseCategories: recurring([
        { name: "Spotify", targetAmount: 10, dueDay: 6 },
        { name: "Netflix", targetAmount: 12, dueDay: 7 },
        { name: "iCloud", targetAmount: 20, dueDay: 8 },
      ]),
    });
    expect(texts(financials(), [], ex)).toContain("3 charges coming up in the next 3 days ($42.00 total).");
  });

  it("stays silent when the charge is further out, already charged, undated, or not charged this cycle", () => {
    for (const e of [
      { dueDay: 9 },
      { dueDay: 7, actual: 20 },
      { dueDay: null },
      { dueDay: 7, chargedThisCycle: false },
    ]) {
      const ex = extras({ now, recurringExpenseCategories: recurring([{ name: "Spotify", ...e }]) });
      expect(find(financials(), [], ex, /will be charged|charges coming up/)).toBeUndefined();
    }
  });

  it("looks across the month end: on Oct 30 a bill on the 1st is 2 days away", () => {
    const ex = extras({
      now: day("2026-10-30"),
      cycle: { periodStart: day("2026-10-16"), periodEnd: null },
      recurringExpenseCategories: recurring([{ name: "Rent", targetAmount: 450, dueDay: 1 }]),
    });
    expect(find(financials(), [], ex, /Rent/)!.text).toBe("Rent ($450.00) will be charged in 2 days.");
  });

  it("clamps a bill on the 31st to the last day of a shorter month instead of skipping it", () => {
    const ex = extras({
      now: day("2026-09-28"),
      cycle: { periodStart: day("2026-09-16"), periodEnd: null },
      recurringExpenseCategories: recurring([{ name: "Internet", targetAmount: 40, dueDay: 31 }]),
    });
    expect(find(financials(), [], ex, /Internet/)!.text).toBe("Internet ($40.00) will be charged in 2 days.");
  });

  it("ranks at the heads-up priority, below the neutral category and goal rules", () => {
    expect(PRIORITY.UPCOMING_CHARGES).toBeLessThan(PRIORITY.CATEGORY_ANOMALY);
    expect(PRIORITY.UPCOMING_CHARGES).toBeLessThan(PRIORITY.GOAL_CONTRIBUTION);
  });
});

describe("expected charge missing", () => {
  const now = day("2026-08-08");

  it("warns when a charge date passed 1-3 days ago with nothing linked", () => {
    const ex = extras({ now, recurringExpenseCategories: recurring([{ name: "Spotify", targetAmount: 0.99, dueDay: 6 }]) });
    const insight = find(financials(), [], ex, /Spotify/)!;
    expect(insight.text).toBe("Spotify ($0.99) was expected on Aug 6 but hasn't shown up yet.");
    expect(insight.key).toBe("missed:re-0:2026-08-06");
  });

  it("outranks the heads-up", () => {
    expect(PRIORITY.MISSED_CHARGE).toBeGreaterThan(PRIORITY.UPCOMING_CHARGES);
  });

  it("stays silent 4+ days after, once it was charged, or when not charged this cycle", () => {
    for (const e of [{ dueDay: 4 }, { dueDay: 6, actual: 0.99 }, { dueDay: 6, chargedThisCycle: false }]) {
      const ex = extras({ now, recurringExpenseCategories: recurring([{ name: "Spotify", targetAmount: 0.99, ...e }]) });
      expect(find(financials(), [], ex, /expected on/)).toBeUndefined();
    }
  });
});

describe("still to be charged this cycle", () => {
  const items = recurring([
    { name: "Rent", targetAmount: 450, dueDay: 15 },
    { name: "Panapass", targetAmount: 20, actual: 5 },
    { name: "Paid", targetAmount: 10, actual: 10 },
  ]);

  it("stays silent before the halfway point", () => {
    expect(find(financials(), [], extras({ now: day("2026-08-07"), recurringExpenseCategories: items }), /still to be charged/)).toBeUndefined();
  });

  it("counts not-started and partial items past halfway, with 'still to be charged' wording", () => {
    const insight = find(financials(), [], extras({ now: day("2026-08-11"), recurringExpenseCategories: items }), /still to be charged/)!;
    expect(insight.text).toBe("2 recurring expenses are still to be charged this cycle ($465.00).");
  });

  it("stays silent when everything is charged", () => {
    const paid = recurring([{ name: "Paid", targetAmount: 10, actual: 10 }]);
    expect(find(financials(), [], extras({ now: day("2026-08-11"), recurringExpenseCategories: paid }), /still to be charged/)).toBeUndefined();
  });
});

describe("pace (based on Safe to spend)", () => {
  it("is over budget when Safe to spend is negative, even with money left, and links to Breakdown", () => {
    const ex = extras({ now: day("2026-08-05"), recurringExpenseCategories: recurring([{ name: "Rent", targetAmount: 1500, dueDay: 15 }]) });
    const insight = find(financials([tx({ amount: 600 })]), [], ex, /over budget/)!;
    // 2000 - 600 = 1400 left, minus 1500 unpaid rent = -100.
    expect(insight.text).toBe("You're $100.00 over budget this cycle so far, with 12 days left.");
    expect(insight.href).toBe("/transactions/breakdown");
    expect(insight.severity).toBe("critical");
  });

  it("over budget outranks the neutral category and goal rules", () => {
    expect(PRIORITY.OVER_BUDGET).toBeGreaterThan(PRIORITY.CATEGORY_ANOMALY);
    expect(PRIORITY.OVER_BUDGET).toBeGreaterThan(PRIORITY.GOAL_CONTRIBUTION);
  });

  it("warns about running out once 3 days have passed and the day-to-day rate won't last", () => {
    // Day 4: $1,200 day-to-day spend = $300/day; $800 left lasts 2 more days, 11 remain.
    const insight = find(financials([tx({ amount: 1200 })]), [], extras({ now: day("2026-08-06") }), /run out/)!;
    expect(insight.text).toMatch(/^At your current pace you'll run out of cash around Aug 8/);
    expect(insight.href).toBe("/transactions/breakdown");
  });

  it("does not warn about running out before 3 days have passed", () => {
    const result = texts(financials([tx({ amount: 1200 })]), [], extras({ now: day("2026-08-04") }));
    expect(result.some((t) => /run out/.test(t))).toBe(false);
  });

  it("leaves charges linked to recurring expenses out of the daily rate", () => {
    // $1,200 rent (linked) + $30 day-to-day by day 4: rate is $7.50/day, not $307.50.
    const current = financials([tx({ amount: 1200, recurringExpenseId: "re-rent" }), tx({ amount: 30 })]);
    const result = texts(current, [], extras({ now: day("2026-08-06") }));
    expect(result.some((t) => /run out/.test(t))).toBe(false);
    expect(result).toContain(en.insights.onTrackPace);
  });

  it("falls back to on track", () => {
    expect(texts(financials(), [], extras())).toContain(en.insights.onTrackPace);
  });
});

describe("category up", () => {
  const groceries = (amount: number) => tx({ amount, expenseCategoryId: "cat-g", categoryName: "Groceries" });
  const halfway = day("2026-08-10"); // day 8 of 15

  it("with one closed cycle, uses the same $15 / 20% thresholds, prorated", () => {
    const previous = [financials([groceries(200)])];
    // Expected by day 8: 200 * 8/15 = 106.67. 150 is $43 and 41% over.
    expect(find(financials([groceries(150)]), previous, extras({ now: halfway }), /Groceries/)!.text).toBe(
      "Groceries spending is up $43.33 vs last cycle.",
    );
  });

  it("with one closed cycle, stays silent for a swing under the $15 floor (the old rule fired at $1)", () => {
    const previous = [financials([groceries(200)])];
    expect(find(financials([groceries(115)]), previous, extras({ now: halfway }), /Groceries/)).toBeUndefined();
  });

  it("with 2+ closed cycles, compares against the average", () => {
    const previous = [financials([groceries(180)]), financials([groceries(220)])];
    expect(find(financials([groceries(150)]), previous, extras({ now: halfway }), /Groceries/)!.text).toBe(
      "Groceries spending is up $43.33 vs your recent average.",
    );
  });

  it("stays silent with no history, for a decrease, or for a category usually under $25", () => {
    expect(find(financials([groceries(150)]), [], extras({ now: halfway }), /Groceries/)).toBeUndefined();
    expect(find(financials([groceries(50)]), [financials([groceries(200)])], extras({ now: halfway }), /Groceries/)).toBeUndefined();
    expect(find(financials([groceries(60)]), [financials([groceries(20)])], extras({ now: halfway }), /Groceries/)).toBeUndefined();
  });
});

describe("close to a savings goal", () => {
  const saving = (amount: number) => tx({ type: "SAVINGS", amount, expenseCategoryId: "goal-1" });

  it("fires within one cycle's planned contribution of the target", () => {
    const ex = extras({ goals: [goal({ savedSoFar: 920, currentCycleRecurringAmount: 100 })] });
    expect(find(financials(), [], ex, /away from hitting/)!.text).toBe("You're $80.00 away from hitting your Emergency fund target.");
  });

  it("fires when this cycle's contribution crosses a milestone", () => {
    const ex = extras({ goals: [goal({ savedSoFar: 520 })] });
    expect(find(financials([saving(100)]), [], ex, /away from hitting/)).toBeDefined();
  });

  it("does not keep firing for a goal sitting near the target with no milestone crossed this cycle", () => {
    const ex = extras({ goals: [goal({ savedSoFar: 850, currentCycleRecurringAmount: 50 })] });
    expect(find(financials(), [], ex, /away from hitting/)).toBeUndefined();
  });

  it("stays silent for a completed goal", () => {
    const ex = extras({ goals: [goal({ savedSoFar: 1000, currentCycleRecurringAmount: 100 })] });
    expect(find(financials(), [], ex, /away from hitting/)).toBeUndefined();
  });
});

describe("goal contribution behind", () => {
  const ex = (now: Date, savings: number) => ({
    current: financials(savings ? [tx({ type: "SAVINGS", amount: savings, expenseCategoryId: "goal-1" })] : []),
    ex: extras({ now, goals: [goal({ currentCycleRecurringAmount: 100 })] }),
  });

  it("fires past 60% of the cycle with less than half the planned amount logged", () => {
    const { current, ex: e } = ex(day("2026-08-12"), 20);
    expect(find(current, [], e, /You planned/)!.text).toBe(
      "You planned $100.00 for Emergency fund this paycheck — only $20.00 logged so far, with 5 days left.",
    );
  });

  it("stays silent before 60% or once half is logged", () => {
    expect(find(ex(day("2026-08-06"), 0).current, [], ex(day("2026-08-06"), 0).ex, /You planned/)).toBeUndefined();
    expect(find(ex(day("2026-08-12"), 50).current, [], ex(day("2026-08-12"), 50).ex, /You planned/)).toBeUndefined();
  });
});

describe("possible duplicate charge", () => {
  const gmail = (occurredAt: string, overrides: Partial<CycleTransactionSummary> = {}) =>
    tx({ name: "McDonald's", amount: 5.49, importSource: "GMAIL", isImported: true, occurredAt: day(occurredAt), ...overrides });

  it("same day: 'charged twice on'", () => {
    const current = financials([gmail("2026-08-05"), gmail("2026-08-05")]);
    expect(texts(current, [], extras({ now: day("2026-08-05") }))).toContain("Possible duplicate: McDonald's ($5.49) charged twice on Aug 5.");
  });

  it("different days: always names both dates", () => {
    const current = financials([gmail("2026-08-06"), gmail("2026-08-05")]);
    expect(texts(current, [], extras({ now: day("2026-08-06") }))).toContain(
      "McDonald's ($5.49) charged on Aug 5 and Aug 6. Is one a duplicate?",
    );
  });

  it("stays silent for manual entries, 4+ days apart, different amounts, or different merchants", () => {
    const now = extras({ now: day("2026-08-09") });
    for (const pair of [
      [gmail("2026-08-05", { importSource: "MANUAL" }), gmail("2026-08-05")],
      [gmail("2026-08-05"), gmail("2026-08-09")],
      [gmail("2026-08-05"), gmail("2026-08-05", { amount: 6 })],
      [gmail("2026-08-05"), gmail("2026-08-05", { name: "Burger King" })],
    ]) {
      expect(find(financials(pair), [], now, /duplicate/i)).toBeUndefined();
    }
  });

  it("matches merchants ignoring case", () => {
    const current = financials([gmail("2026-08-05"), gmail("2026-08-05", { name: "MCDONALD'S" })]);
    expect(find(current, [], extras({ now: day("2026-08-05") }), /duplicate/i)).toBeDefined();
  });
});

describe("dismiss memory", () => {
  const ex = (memory: InsightMemoryRecord[], now = day("2026-08-05")) =>
    extras({ now, memory, recurringExpenseCategories: recurring([{ name: "Spotify", targetAmount: 0.99, dueDay: 7 }]) });
  const key = "upcoming:cycle-1";
  const fingerprint = "re-0@2026-08-07";

  it("hides a dismissed insight while its data is unchanged", () => {
    expect(find(financials(), [], ex([{ key, fingerprint, until: null }]), /Spotify/)).toBeUndefined();
  });

  it("shows it again once the data behind it changes", () => {
    expect(find(financials(), [], ex([{ key, fingerprint: "re-0@2026-08-06", until: null }]), /Spotify/)).toBeDefined();
  });

  it("'*' hides it whatever the data", () => {
    expect(find(financials(), [], ex([{ key, fingerprint: "*", until: null }]), /Spotify/)).toBeUndefined();
  });

  it("a temporary dismissal expires", () => {
    const until = day("2026-08-05");
    expect(find(financials(), [], ex([{ key, fingerprint, until }], day("2026-08-06")), /Spotify/)).toBeDefined();
  });

  it("dismissing one duplicate pair surfaces the next", () => {
    const g = (id: string, name: string) => tx({ id, name, amount: 5, importSource: "GMAIL", occurredAt: day("2026-08-05") });
    const current = financials([g("a", "Uber"), g("b", "Uber"), g("c", "Taxi"), g("d", "Taxi")]);
    const memory = [{ key: "duplicate:a:b", fingerprint: "", until: null }];
    expect(texts(current, [], extras({ now: day("2026-08-05"), memory }))).toContain("Possible duplicate: Taxi ($5.00) charged twice on Aug 5.");
  });
});

describe("selection", () => {
  it("shows at most 2, highest priority first, one per rule", () => {
    const g = (id: string) => tx({ id, name: "Uber", amount: 5, importSource: "GMAIL", occurredAt: day("2026-08-05") });
    const current = financials([g("a"), g("b"), g("c")]);
    const ex = extras({
      now: day("2026-08-05"),
      recurringExpenseCategories: recurring([{ name: "Rent", targetAmount: 1990, dueDay: 7 }]),
    });
    const result = generateInsights(current, [], ex);
    expect(result).toHaveLength(2);
    expect(result[0].text).toMatch(/over budget/);
    expect(result[1].text).toMatch(/duplicate/i);
  });
});
