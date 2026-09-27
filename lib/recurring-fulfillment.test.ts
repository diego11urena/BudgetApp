import { describe, it, expect } from "vitest";
import { summarizeRecurringFulfillment } from "./recurring-fulfillment";
import type { CategoryWithRecurringExpenses, RecurringExpenseWithStatus } from "./recurring-expenses";

/** Minimal fixture -- only the fields summarizeRecurringFulfillment actually reads. */
function expense(overrides: Partial<RecurringExpenseWithStatus>): RecurringExpenseWithStatus {
  return {
    id: overrides.name ?? "expense",
    name: "Expense",
    targetAmount: 100,
    actual: 0,
    recurring: true,
    hasFixedDate: true,
    dueDay: null,
    status: "not-started",
    suggestedMatch: null,
    ...overrides,
  };
}

function category(expenses: RecurringExpenseWithStatus[]): CategoryWithRecurringExpenses {
  return {
    categoryId: "cat-1",
    categoryName: "Category",
    categoryIcon: null,
    budgetTotal: 0,
    actual: 0,
    expenses,
  };
}

describe("summarizeRecurringFulfillment", () => {
  it("counts Scheduled items as charged once any payment has landed (not-started only counts against total)", () => {
    const result = summarizeRecurringFulfillment(
      [
        category([
          expense({ name: "Rent", hasFixedDate: true, status: "paid" }),
          expense({ name: "Internet", hasFixedDate: true, status: "partial" }),
          expense({ name: "Netflix", hasFixedDate: true, status: "not-started" }),
        ]),
      ],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.scheduled.total).toBe(3);
    expect(result.scheduled.chargedOnTime).toBe(2);
  });

  it("names the not-started exception, distinguishing overdue (missing) from upcoming", () => {
    const result = summarizeRecurringFulfillment(
      [
        category([
          expense({ name: "Netflix", hasFixedDate: true, status: "not-started", dueDay: 10 }), // Aug 10, before "now" -- overdue
        ]),
      ],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.scheduled.exception).toEqual({ name: "Netflix", kind: "missing", dueDate: new Date("2026-08-10T05:00:00.000Z") });
  });

  it("marks a due-today item as missing, not upcoming (matches lib/insights.ts's own overdue convention)", () => {
    const result = summarizeRecurringFulfillment(
      [category([expense({ name: "Rent", hasFixedDate: true, status: "not-started", dueDay: 15 })])],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.scheduled.exception?.kind).toBe("missing");
  });

  it("marks a not-yet-due item as upcoming", () => {
    const result = summarizeRecurringFulfillment(
      [category([expense({ name: "Internet", hasFixedDate: true, status: "not-started", dueDay: 30 })])],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.scheduled.exception).toEqual({ name: "Internet", kind: "upcoming", dueDate: new Date("2026-08-30T05:00:00.000Z") });
  });

  it("picks the most urgent not-started item -- overdue beats upcoming, and among same-kind picks the closest date", () => {
    const result = summarizeRecurringFulfillment(
      [
        category([
          expense({ name: "Due later", hasFixedDate: true, status: "not-started", dueDay: 28 }), // upcoming, far
          expense({ name: "Most overdue", hasFixedDate: true, status: "not-started", dueDay: 1 }), // overdue by 14 days
          expense({ name: "Just overdue", hasFixedDate: true, status: "not-started", dueDay: 14 }), // overdue by 1 day
        ]),
      ],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.scheduled.exception?.name).toBe("Most overdue");
  });

  it("sorts an unresolvable dueDay (e.g. the 31st in a 30-day month) last", () => {
    const result = summarizeRecurringFulfillment(
      [
        category([
          expense({ name: "Unresolvable", hasFixedDate: true, status: "not-started", dueDay: 31 }), // April has 30 days
          expense({ name: "Real date", hasFixedDate: true, status: "not-started", dueDay: 20 }),
        ]),
      ],
      new Date("2026-04-15T12:00:00.000Z"),
    );

    expect(result.scheduled.exception?.name).toBe("Real date");
  });

  it("returns exception: null when every Scheduled item is charged", () => {
    const result = summarizeRecurringFulfillment(
      [category([expense({ name: "Rent", hasFixedDate: true, status: "paid" })])],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.scheduled.exception).toBeNull();
  });

  it("ongoing.loggedNames only includes Ongoing items with status logged, alphabetically sorted, never a Scheduled item", () => {
    const result = summarizeRecurringFulfillment(
      [
        category([
          expense({ name: "Panapass", hasFixedDate: false, status: "logged" }),
          expense({ name: "Haircut", hasFixedDate: false, status: "logged" }),
          expense({ name: "Groceries", hasFixedDate: false, status: "not-logged" }),
          expense({ name: "Rent", hasFixedDate: true, status: "paid" }),
        ]),
      ],
      new Date("2026-08-15T12:00:00.000Z"),
    );

    expect(result.ongoing.loggedNames).toEqual(["Haircut", "Panapass"]);
  });
});
