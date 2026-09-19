-- Replaces RecurringExpense.frequency (BIWEEKLY/MONTHLY) with a plain
-- hasFixedDate boolean -- see the model's own doc comment in schema.prisma.
--
-- The backfill (step 2 below) is folded directly into this migration
-- rather than left to a separately-run script: `hasFixedDate = true` for
-- an existing MONTHLY row directly changes shouldCarryForwardToCycle's
-- behavior (see lib/cycles.ts), so a deploy that added the column with its
-- default (false) and dropped `frequency` WITHOUT this UPDATE having
-- already run would silently turn every existing Scheduled item into an
-- Ongoing one -- unlike the additive, backfill-run-whenever-convenient
-- prisma/backfill-recurring-expenses.ts precedent, there is no safe
-- "default false, fix it up later" window here to leave open.
--
-- Verified lossless before writing this: audited both dev and production
-- (read-only) for the only two data shapes that would make this backfill
-- rule ambiguous -- a MONTHLY row with no dueDay, or a BIWEEKLY row WITH a
-- dueDay (possible via the onboarding expenses step, which stored dueDay
-- without ever setting frequency to MONTHLY to match -- fixed alongside
-- this migration in app/(onboarding)/onboarding/expenses/actions.ts).
-- Production had exactly 10 RecurringExpense rows: 5 MONTHLY (all with
-- dueDay set) and 5 BIWEEKLY (all with dueDay null) -- a clean split, zero
-- rows in either ambiguous bucket.

-- 1. Add the new column. Defaults to false (Ongoing) -- correct for every
--    existing BIWEEKLY row already, and about to be corrected for MONTHLY
--    rows by the UPDATE below before anything reads it as final.
ALTER TABLE "RecurringExpense" ADD COLUMN "hasFixedDate" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: every row that was MONTHLY becomes Scheduled. (Every
--    MONTHLY row already has dueDay set in both dev and production, per
--    the audit above, but the WHERE clause intentionally keys off
--    `frequency` alone, not dueDay -- MONTHLY *is* the "Scheduled" signal
--    this column existed to carry; dueDay is just its detail.)
UPDATE "RecurringExpense" SET "hasFixedDate" = true WHERE "frequency" = 'MONTHLY';

-- 3. Drop the old column. RecurringFrequency the enum type stays --
--    ExpenseCategory.frequency (the Goals tab's own, separate carry-
--    forward field) still uses it, untouched by this migration.
ALTER TABLE "RecurringExpense" DROP COLUMN "frequency";
