import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import {
  carryForwardRecurringExpenses,
  closeCycleAndStartNext,
  linkOrCreateRecurringExpenseForTransaction,
  recomputeCategoryBudgetGoal,
  unlinkTransactionFromRecurringExpense,
} from "./cycles";

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

  describe("linkOrCreateRecurringExpenseForTransaction (the 'This is a recurring expense' toggle)", () => {
    async function makeTransaction(cycleId: string, categoryId: string, name: string, amount: number) {
      return prisma.cycleTransaction.create({
        data: { cycleId, type: "EXPENSE", name, amount, expenseCategoryId: categoryId },
      });
    }

    it("creates a new recurring expense and links the transaction when there's no existing match", async () => {
      const category = await makeExpenseCategory("Transportation");
      const cycle = await makeCycle(new Date(2026, 7, 3));
      const tx = await makeTransaction(cycle.id, category.id, "Panapass", 20);

      await linkOrCreateRecurringExpenseForTransaction(prisma, {
        userId,
        transactionId: tx.id,
        categoryId: category.id,
        cycleId: cycle.id,
        name: "Panapass",
        amount: 20,
      });

      const updated = await prisma.cycleTransaction.findUniqueOrThrow({ where: { id: tx.id } });
      expect(updated.recurringExpenseId).not.toBeNull();

      const recurringExpense = await prisma.recurringExpense.findUniqueOrThrow({
        where: { id: updated.recurringExpenseId! },
      });
      expect(recurringExpense.name).toBe("Panapass");
      expect(recurringExpense.amount.toNumber()).toBe(20);
      expect(recurringExpense.frequency).toBe("BIWEEKLY");

      const snapshot = await prisma.cycleRecurringExpense.findUnique({
        where: { cycleId_recurringExpenseId: { cycleId: cycle.id, recurringExpenseId: recurringExpense.id } },
      });
      expect(snapshot?.targetAmount.toNumber()).toBe(20);

      const goal = await prisma.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id } },
      });
      expect(goal?.targetAmount.toNumber()).toBe(20);
    });

    it("links three same-named, same-cycle transactions to the SAME recurring expense instead of creating three", async () => {
      const category = await makeExpenseCategory("Transportation");
      const cycle = await makeCycle(new Date(2026, 7, 3));
      const tx1 = await makeTransaction(cycle.id, category.id, "Panapass", 20);
      const tx2 = await makeTransaction(cycle.id, category.id, "Panapass", 15);
      const tx3 = await makeTransaction(cycle.id, category.id, " panapass ", 10);

      for (const tx of [tx1, tx2, tx3]) {
        await linkOrCreateRecurringExpenseForTransaction(prisma, {
          userId,
          transactionId: tx.id,
          categoryId: category.id,
          cycleId: cycle.id,
          name: tx.name,
          amount: tx.amount.toNumber(),
        });
      }

      const updated1 = await prisma.cycleTransaction.findUniqueOrThrow({ where: { id: tx1.id } });
      const updated2 = await prisma.cycleTransaction.findUniqueOrThrow({ where: { id: tx2.id } });
      const updated3 = await prisma.cycleTransaction.findUniqueOrThrow({ where: { id: tx3.id } });
      expect(updated2.recurringExpenseId).toBe(updated1.recurringExpenseId);
      expect(updated3.recurringExpenseId).toBe(updated1.recurringExpenseId);

      const allRecurringExpenses = await prisma.recurringExpense.findMany({ where: { categoryId: category.id } });
      expect(allRecurringExpenses).toHaveLength(1);

      // The FIRST transaction's amount is what became the recurring
      // expense's own amount/target -- later matches reuse the recurring
      // expense's own current amount as target, not their own amount.
      const snapshot = await prisma.cycleRecurringExpense.findUnique({
        where: { cycleId_recurringExpenseId: { cycleId: cycle.id, recurringExpenseId: updated1.recurringExpenseId! } },
      });
      expect(snapshot?.targetAmount.toNumber()).toBe(20);
    });

    it("matches an existing recurring expense by exact case-insensitive trimmed name, scoped to the same category", async () => {
      const category = await makeExpenseCategory("Subscriptions");
      const otherCategory = await makeExpenseCategory("Entertainment");
      const cycle = await makeCycle(new Date(2026, 7, 3));

      const existingSpotify = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Spotify", amount: 6.99 },
      });
      // Same name, different category -- must NOT match (category-scoped).
      await prisma.recurringExpense.create({
        data: { userId, categoryId: otherCategory.id, name: "Spotify", amount: 99 },
      });

      const tx = await makeTransaction(cycle.id, category.id, "SPOTIFY", 6.99);

      await linkOrCreateRecurringExpenseForTransaction(prisma, {
        userId,
        transactionId: tx.id,
        categoryId: category.id,
        cycleId: cycle.id,
        name: "SPOTIFY",
        amount: 6.99,
      });

      const updated = await prisma.cycleTransaction.findUniqueOrThrow({ where: { id: tx.id } });
      expect(updated.recurringExpenseId).toBe(existingSpotify.id);

      const allRecurringExpenses = await prisma.recurringExpense.findMany({ where: { categoryId: category.id } });
      expect(allRecurringExpenses).toHaveLength(1);
    });

    it("creates this cycle's snapshot using the existing recurring expense's own amount, not the transaction's amount", async () => {
      const category = await makeExpenseCategory("Subscriptions");
      const cycle = await makeCycle(new Date(2026, 7, 3));
      const existing = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Netflix", amount: 15.99 },
      });
      // A one-off price variation on this specific transaction shouldn't
      // become the new target.
      const tx = await makeTransaction(cycle.id, category.id, "Netflix", 17.5);

      await linkOrCreateRecurringExpenseForTransaction(prisma, {
        userId,
        transactionId: tx.id,
        categoryId: category.id,
        cycleId: cycle.id,
        name: "Netflix",
        amount: 17.5,
      });

      const snapshot = await prisma.cycleRecurringExpense.findUnique({
        where: { cycleId_recurringExpenseId: { cycleId: cycle.id, recurringExpenseId: existing.id } },
      });
      expect(snapshot?.targetAmount.toNumber()).toBe(15.99);
    });
  });

  describe("unlinkTransactionFromRecurringExpense (the toggle's off-transition)", () => {
    it("clears the transaction's link without deleting the underlying recurring expense", async () => {
      const category = await makeExpenseCategory("Subscriptions");
      const cycle = await makeCycle(new Date(2026, 7, 3));
      const recurringExpense = await prisma.recurringExpense.create({
        data: { userId, categoryId: category.id, name: "Spotify", amount: 6.99 },
      });
      await prisma.cycleRecurringExpense.create({
        data: { cycleId: cycle.id, recurringExpenseId: recurringExpense.id, targetAmount: 6.99 },
      });
      await recomputeCategoryBudgetGoal(prisma, cycle.id, category.id);
      const tx = await prisma.cycleTransaction.create({
        data: {
          cycleId: cycle.id,
          type: "EXPENSE",
          name: "Spotify",
          amount: 6.99,
          expenseCategoryId: category.id,
          recurringExpenseId: recurringExpense.id,
        },
      });

      await unlinkTransactionFromRecurringExpense(prisma, {
        transactionId: tx.id,
        cycleId: cycle.id,
        categoryId: category.id,
      });

      const updated = await prisma.cycleTransaction.findUniqueOrThrow({ where: { id: tx.id } });
      expect(updated.recurringExpenseId).toBeNull();

      const stillExists = await prisma.recurringExpense.findUnique({ where: { id: recurringExpense.id } });
      expect(stillExists).not.toBeNull();
    });
  });
});
