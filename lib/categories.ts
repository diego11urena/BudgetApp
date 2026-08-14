import type { Prisma, PrismaClient } from "@/app/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Starter set for a brand-new user — Income never had a category concept
 * before, so unlike Expense/Savings (which build up organically as you add
 * fixed expenses/goals in onboarding) there's nothing for the picker to
 * show without this. Same list a one-time migration seeded for every
 * pre-existing user (prisma/migrations/20260814205600_seed_income_categories).
 * Just a starting point — renameable/mergeable in Profile like any other
 * category, "Other" isn't a protected system category.
 */
export const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Transfer",
  "Reimbursement",
  "Gift",
  "Side work",
  "Other",
] as const;

/** Creates every DEFAULT_INCOME_CATEGORIES entry for a just-created user. Safe to call more than once — getOrCreateCategory is an upsert. */
export async function seedDefaultIncomeCategories(db: Db, userId: string) {
  for (const name of DEFAULT_INCOME_CATEGORIES) {
    await getOrCreateCategory(db, userId, name, "INCOME");
  }
}

/**
 * Finds a user's category by name+type, creating it if it doesn't exist
 * yet. The single canonical way every callsite that just needs to resolve a
 * free-text category name (an amount sheet's typed/selected category, a
 * budget target's name, an onboarding line item) to its ExpenseCategory id
 * should do it — a category-name collision across type (bug: creating a
 * Goal with the same name as an existing Budget category silently failing
 * to appear anywhere) traced back to these upsert clauses having quietly
 * drifted from each other. Accepts either the top-level Prisma client or an
 * interactive $transaction's tx client, since callers that need this inside
 * a larger atomic write (onboarding's expenses/savings steps) still need it
 * to participate in that transaction.
 *
 * Not used by callers that need the upsert's *update* branch to do real
 * work (e.g. goals/actions.ts sets lifetimeTargetAmount/recurring on every
 * upsert, not just on create) — those aren't this same "resolve a name"
 * pattern and stay as their own explicit upsert.
 */
export function getOrCreateCategory(
  db: Db,
  userId: string,
  name: string,
  type: "EXPENSE" | "INCOME" | "SAVINGS",
) {
  return db.expenseCategory.upsert({
    where: { userId_name_type: { userId, name, type } },
    create: { userId, name, type },
    update: {},
  });
}
