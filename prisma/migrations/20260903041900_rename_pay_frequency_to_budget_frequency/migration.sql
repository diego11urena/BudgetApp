-- Splitting a single fused "payFrequency" (budget-cycle cadence AND an
-- attempted proxy for pay cadence) into two independent settings. This
-- migration renames the EXISTING field/enum -- the one that has always
-- driven cycle-boundary/pace/carry-forward math -- to its correct name,
-- budgetFrequency. A genuinely new, separate payFrequency (income
-- cadence, gates no calculation) is added by the next migration. Real
-- ALTER TYPE RENAME / RENAME COLUMN, not drop+recreate, so every existing
-- account's setting survives unchanged (verified against
-- pg_constraint/psql before writing this file, not generated
-- non-interactively -- `prisma migrate dev` refuses to run at all outside
-- a TTY in this environment, and its own warning confirmed a naive diff
-- would have dropped the column outright).
ALTER TYPE "PayFrequency" RENAME TO "BudgetFrequency";
ALTER TABLE "User" RENAME COLUMN "payFrequency" TO "budgetFrequency";
