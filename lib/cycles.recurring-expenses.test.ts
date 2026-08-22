import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { carryForwardRecurringExpenses, closeCycleAndStartNext, recomputeCategoryBudgetGoal } from "./cycles";

// Real-Postgres tests for the Recurring Expenses two-level model's
// carry-forward/aggregate machinery -- same pattern as
// cycles.concurrency.test.ts (skipped unless DATABASE_URL is set).
describe.skipIf(!process.env.DATABASE_URL)("recurring expenses: aggregate + carry-forward", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `recurring-expenses-${randomUUID()}@example.test`,
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

  describe("recomputeCategoryBudgetGoal", () => {
    it("sums multiple recurring expenses in the same category into one CycleBudgetGoal", async () => {
      const category = await makeExpenseCategory("Subscriptions");
      const cycle = await makeCycle(new Date(2026, 7, 3));

      const spotify = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Spotify", amount: 9.99 },
      });
      const netflix = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Netflix", amount: 15.99 },
      });
      await prisma.cycleRecurringExpense.createMany({
        data: [
          { cycleId: cycle.id, recurringExpenseId: spotify.id, targetAmount: 9.99 },
          { cycleId: cycle.id, recurringExpenseId: netflix.id, targetAmount: 15.99 },
        ],
      });

      await recomputeCategoryBudgetGoal(prisma, cycle.id, category.id);

      const goal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id } },
      });
      expect(goal?.targetAmount.toNumber()).toBeCloseTo(25.98);
    });

    it("deletes the CycleBudgetGoal row entirely once every recurring expense is gone, rather than leaving a $0 row", async () => {
      const category = await makeExpenseCategory("Subscriptions");
      const cycle = await makeCycle(new Date(2026, 7, 3));

      const spotify = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Spotify", amount: 9.99 },
      });
      await prisma.cycleRecurringExpense.create({
        data: { cycleId: cycle.id, recurringExpenseId: spotify.id, targetAmount: 9.99 },
      });
      await recomputeCategoryBudgetGoal(prisma, cycle.id, category.id);
      await prisma.cycleRecurringExpense.deleteMany({ where: { recurringExpenseId: spotify.id } });

      await recomputeCategoryBudgetGoal(prisma, cycle.id, category.id);

      const goal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id } },
      });
      expect(goal).toBeNull();
    });
  });

  describe("carryForwardRecurringExpenses", () => {
    it("carries a BIWEEKLY recurring expense into every new cycle and recomputes its category's aggregate", async () => {
      const category = await makeExpenseCategory("Transport");
      const panapass = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "PanaPass", amount: 20, frequency: "BIWEEKLY" },
      });
      const newCycle = await makeCycle(new Date(2026, 7, 20));

      await carryForwardRecurringExpenses(prisma, userId, newCycle.id, newCycle.periodStart);

      const snapshot = await prisma.cycleRecurringExpense.findUnique({
        where: { cycleId_recurringExpenseId: { cycleId: newCycle.id, recurringExpenseId: panapass.id } },
      });
      expect(snapshot?.targetAmount.toNumber()).toBe(20);

      const goal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: newCycle.id, expenseCategoryId: category.id } },
      });
      expect(goal?.targetAmount.toNumber()).toBe(20);
    });

    it("only carries a MONTHLY recurring expense into the one quincena matching its due day", async () => {
      const category = await makeExpenseCategory("Fitness");
      await prisma.recurringExpense.create({
        data: {
          userId,
          categoryId: category.id,
          name: "Gym",
          amount: 45,
          frequency: "MONTHLY",
          dueDay: 28,
        },
      });

      const firstQuincenaCycle = await makeCycle(new Date(2026, 7, 3));
      await carryForwardRecurringExpenses(prisma, userId, firstQuincenaCycle.id, firstQuincenaCycle.periodStart);
      const goalInFirst = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: firstQuincenaCycle.id, expenseCategoryId: category.id } },
      });
      expect(goalInFirst).toBeNull();

      // Only one DRAFT/ACTIVE cycle per user is allowed at a time (a real
      // DB constraint -- see cycles.concurrency.test.ts) -- close the first
      // before creating the second.
      await prisma.budgetCycle.update({ where: { id: firstQuincenaCycle.id }, data: { status: "CLOSED" } });

      const secondQuincenaCycle = await makeCycle(new Date(2026, 7, 20));
      await carryForwardRecurringExpenses(prisma, userId, secondQuincenaCycle.id, secondQuincenaCycle.periodStart);
      const goalInSecond = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: secondQuincenaCycle.id, expenseCategoryId: category.id } },
      });
      expect(goalInSecond?.targetAmount.toNumber()).toBe(45);
    });

    it("never carries a recurring: false expense forward", async () => {
      const category = await makeExpenseCategory("One-off");
      await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Repair", amount: 100, recurring: false },
      });
      const newCycle = await makeCycle(new Date(2026, 7, 3));

      await carryForwardRecurringExpenses(prisma, userId, newCycle.id, newCycle.periodStart);

      const goal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: newCycle.id, expenseCategoryId: category.id } },
      });
      expect(goal).toBeNull();
    });
  });

  describe("closeCycleAndStartNext (EXPENSE/SAVINGS split)", () => {
    it("carries forward both an EXPENSE recurring expense and a SAVINGS recurring goal when closing a cycle", async () => {
      const expenseCategory = await makeExpenseCategory("Subscriptions");
      const savingsCategory = await prisma.expenseCategory.create({
        data: { userId, name: "Emergency fund", type: "SAVINGS", recurring: true },
      });

      const currentCycle = await prisma.budgetCycle.create({
        data: { userId, label: "current", periodStart: new Date(2026, 7, 3), status: "ACTIVE" },
      });

      const spotify = await prisma.recurringExpense.create({
        data: { userId, categoryId: expenseCategory.id, name: "Spotify", amount: 9.99 },
      });
      await prisma.cycleRecurringExpense.create({
        data: { cycleId: currentCycle.id, recurringExpenseId: spotify.id, targetAmount: 9.99 },
      });
      await recomputeCategoryBudgetGoal(prisma, currentCycle.id, expenseCategory.id);

      await prisma.cycleBudgetGoal.create({
        data: { cycleId: currentCycle.id, expenseCategoryId: savingsCategory.id, targetAmount: 50 },
      });

      const { newCycle } = await closeCycleAndStartNext(userId, new Date(2026, 7, 18));

      const expenseGoal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: newCycle.id, expenseCategoryId: expenseCategory.id } },
      });
      expect(expenseGoal?.targetAmount.toNumber()).toBe(9.99);

      const savingsGoal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: newCycle.id, expenseCategoryId: savingsCategory.id } },
      });
      expect(savingsGoal?.targetAmount.toNumber()).toBe(50);

      const newSnapshot = await prisma.cycleRecurringExpense.findUnique({
        where: { cycleId_recurringExpenseId: { cycleId: newCycle.id, recurringExpenseId: spotify.id } },
      });
      expect(newSnapshot?.targetAmount.toNumber()).toBe(9.99);
    });
  });
});
