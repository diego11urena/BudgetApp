// One-time backfill for the RecurringExpense / CycleRecurringExpense
// two-level model (see the "Recurring Expenses" redesign). For every
// existing EXPENSE-type category that has at least one CycleBudgetGoal,
// creates a single RecurringExpense named after the category (amount/
// frequency/dueDay copied from the category), plus one CycleRecurringExpense
// snapshot per existing CycleBudgetGoal row -- so every fixed expense that
// existed before this migration becomes "one recurring expense named after
// its category," with CycleBudgetGoal.targetAmount staying correct (now
// equal to the sum of exactly one child, matching the maintained-aggregate
// invariant the new server actions rely on).
//
// Idempotent: a category that already has a RecurringExpense is skipped
// entirely, so re-running (e.g. once in dev, once against production) is
// safe and does nothing on a second pass.
import { prisma } from "@/lib/prisma";

async function main() {
  const categories = await prisma.expenseCategory.findMany({
    where: {
      type: "EXPENSE",
      budgetGoals: { some: {} },
    },
    include: {
      budgetGoals: true,
      recurringExpenses: { select: { id: true }, take: 1 },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const category of categories) {
    if (category.recurringExpenses.length > 0) {
      skipped++;
      continue;
    }

    // A category can have more than one CycleBudgetGoal (one per cycle it
    // was budgeted in) -- the RecurringExpense's own "amount" is seeded
    // from the most recently created goal, matching what a user would see
    // as the "current" target today.
    const latestGoal = category.budgetGoals.reduce((latest, goal) =>
      goal.createdAt > latest.createdAt ? goal : latest,
    );

    await prisma.$transaction(async (tx) => {
      const recurringExpense = await tx.recurringExpense.create({
        data: {
          userId: category.userId,
          categoryId: category.id,
          name: category.name,
          amount: latestGoal.targetAmount,
          recurring: category.recurring,
          frequency: category.frequency,
          dueDay: category.dueDay,
        },
      });

      await tx.cycleRecurringExpense.createMany({
        data: category.budgetGoals.map((goal) => ({
          cycleId: goal.cycleId,
          recurringExpenseId: recurringExpense.id,
          targetAmount: goal.targetAmount,
        })),
      });
    });

    created++;
  }

  console.log(
    `Backfilled ${created} recurring expense(s) from existing categories; skipped ${skipped} already-backfilled categor${skipped === 1 ? "y" : "ies"}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
