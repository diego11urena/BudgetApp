import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getRecurringExpensesForCycle, summarizeRecurringExpenses } from "./recurring-expenses";

// Real-Postgres tests for getRecurringExpensesForCycle -- ~100 lines of
// money aggregation feeding the whole Recurring Expenses tab (and, since
// Batch 1, the dashboard) with previously zero test coverage. Same pattern
// as cycles.recurring-expenses.test.ts (skipped unless DATABASE_URL is set).
describe.skipIf(!process.env.DATABASE_URL)("getRecurringExpensesForCycle", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `recurring-expenses-query-${randomUUID()}@example.test`,
        hashedPassword: "not-a-real-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  async function makeExpenseCategory(name: string) {
    return prisma.expenseCategory.create({ data: { userId, name, type: "EXPENSE" } });
  }

  async function makeCycle(periodStart: Date) {
    return prisma.budgetCycle.create({
      data: { userId, label: "test", periodStart, status: "ACTIVE" },
    });
  }

  async function makeRecurringExpenseWithSnapshot(categoryId: string, cycleId: string, name: string, amount: number) {
    const recurringExpense = await prisma.recurringExpense.create({
      data: { userId, categoryId, name, amount },
    });
    await prisma.cycleRecurringExpense.create({
      data: { cycleId, recurringExpenseId: recurringExpense.id, targetAmount: amount },
    });
    return recurringExpense;
  }

  it("returns an empty array for a cycle with no recurring-expense snapshots", async () => {
    const cycle = await makeCycle(new Date(2026, 7, 3));
    expect(await getRecurringExpensesForCycle(userId, cycle.id)).toEqual([]);
  });

  it("groups multiple recurring expenses in the same category, summing target and actual", async () => {
    const category = await makeExpenseCategory("Subscriptions");
    const cycle = await makeCycle(new Date(2026, 7, 3));
    const spotify = await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Spotify", 9.99);
    await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Netflix", 15.99);
    await prisma.cycleTransaction.create({
      data: {
        cycleId: cycle.id,
        userId,
        type: "EXPENSE",
        name: "Spotify",
        amount: 9.99,
        expenseCategoryId: category.id,
        recurringExpenseId: spotify.id,
      },
    });

    const result = await getRecurringExpensesForCycle(userId, cycle.id);

    expect(result).toHaveLength(1);
    expect(result[0].categoryName).toBe("Subscriptions");
    expect(result[0].budgetTotal).toBeCloseTo(25.98);
    expect(result[0].actual).toBeCloseTo(9.99);
    expect(result[0].expenses).toHaveLength(2);
  });

  it("scopes actual to only transactions actually LINKED to the recurring expense, not every transaction in the category", async () => {
    // This is the exact bug class 1.1 fixed at the dashboard/budget level --
    // an unlinked transaction sitting in the same category must never
    // inflate a recurring expense's own "actual" figure.
    const category = await makeExpenseCategory("Groceries");
    const cycle = await makeCycle(new Date(2026, 7, 3));
    const weeklyShop = await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Weekly shop", 100);
    await prisma.cycleTransaction.create({
      data: {
        cycleId: cycle.id,
        userId,
        type: "EXPENSE",
        name: "Weekly shop",
        amount: 100,
        expenseCategoryId: category.id,
        recurringExpenseId: weeklyShop.id,
      },
    });
    // Same category, but never linked -- must not count toward actual.
    await prisma.cycleTransaction.create({
      data: { cycleId: cycle.id, userId, type: "EXPENSE", name: "Snacks", amount: 12, expenseCategoryId: category.id },
    });

    const result = await getRecurringExpensesForCycle(userId, cycle.id);

    expect(result[0].actual).toBe(100);
    expect(result[0].expenses[0].actual).toBe(100);
  });

  it("separates recurring expenses in different categories into their own entries", async () => {
    const subscriptions = await makeExpenseCategory("Subscriptions");
    const transport = await makeExpenseCategory("Transport");
    const cycle = await makeCycle(new Date(2026, 7, 3));
    await makeRecurringExpenseWithSnapshot(subscriptions.id, cycle.id, "Spotify", 9.99);
    await makeRecurringExpenseWithSnapshot(transport.id, cycle.id, "PanaPass", 20);

    const result = await getRecurringExpensesForCycle(userId, cycle.id);

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.categoryName).sort()).toEqual(["Subscriptions", "Transport"]);
  });

  it("suggests a match from an unlinked same-category transaction when nothing's been paid yet", async () => {
    const category = await makeExpenseCategory("Subscriptions");
    const cycle = await makeCycle(new Date(2026, 7, 3));
    await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Netflix", 15.99);
    const candidate = await prisma.cycleTransaction.create({
      data: { cycleId: cycle.id, userId, type: "EXPENSE", name: "Netflix", amount: 15.99, expenseCategoryId: category.id },
    });

    const result = await getRecurringExpensesForCycle(userId, cycle.id);

    expect(result[0].expenses[0].suggestedMatch?.transactionId).toBe(candidate.id);
  });

  it("skips suggestion computation entirely when computeSuggestions is false", async () => {
    const category = await makeExpenseCategory("Subscriptions");
    const cycle = await makeCycle(new Date(2026, 7, 3));
    await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Netflix", 15.99);
    await prisma.cycleTransaction.create({
      data: { cycleId: cycle.id, userId, type: "EXPENSE", name: "Netflix", amount: 15.99, expenseCategoryId: category.id },
    });

    const result = await getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false });

    expect(result[0].expenses[0].suggestedMatch).toBeNull();
  });

  it("feeds summarizeRecurringExpenses a shape that produces the right paid-count and pending amount", async () => {
    const category = await makeExpenseCategory("Subscriptions");
    const cycle = await makeCycle(new Date(2026, 7, 3));
    const paid = await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Spotify", 9.99);
    await makeRecurringExpenseWithSnapshot(category.id, cycle.id, "Netflix", 15.99);
    await prisma.cycleTransaction.create({
      data: {
        cycleId: cycle.id,
        userId,
        type: "EXPENSE",
        name: "Spotify",
        amount: 9.99,
        expenseCategoryId: category.id,
        recurringExpenseId: paid.id,
      },
    });

    const categories = await getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false });
    const summary = summarizeRecurringExpenses(categories);

    expect(summary.totalCount).toBe(2);
    expect(summary.paidCount).toBe(1);
    expect(summary.pendingAmount).toBeCloseTo(15.99);
  });
});
