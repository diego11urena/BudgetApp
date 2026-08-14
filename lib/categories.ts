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
 * Matches case-insensitively (and trims first) so "rent" reuses an existing
 * "Rent" instead of silently creating a second, competing category —
 * CategoryNameInput's dropdown is the client-side half of this same fix
 * (it nudges picking the exact existing spelling), but this is the actual
 * backstop: it holds regardless of which UI path a name came through.
 * Postgres text equality is case-sensitive by default, so this can't be
 * expressed as the unique constraint itself (userId_name_type) — it's a
 * find-then-create instead of a single upsert, which isn't atomic against
 * a true concurrent double-submit of two different-cased spellings, an
 * acceptable trade-off at this app's personal-budgeting scale rather than
 * a functional unique index migration.
 *
 * Not used by callers that need the upsert's *update* branch to do real
 * work (e.g. goals/actions.ts sets lifetimeTargetAmount/recurring on every
 * upsert, not just on create) — those aren't this same "resolve a name"
 * pattern and stay as their own explicit upsert.
 */
export async function getOrCreateCategory(
  db: Db,
  userId: string,
  name: string,
  type: "EXPENSE" | "INCOME" | "SAVINGS",
) {
  const trimmed = name.trim();
  const existing = await db.expenseCategory.findFirst({
    where: { userId, type, name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;

  return db.expenseCategory.create({ data: { userId, name: trimmed, type } });
}
