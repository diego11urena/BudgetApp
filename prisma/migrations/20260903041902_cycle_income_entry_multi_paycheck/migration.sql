-- Drops the unique index that capped a BudgetCycle at exactly one income
-- entry per source -- fine when "one paycheck = one cycle" was universal,
-- wrong once a MONTHLY-budget cycle needs to hold 2+ additively-logged
-- paychecks. getCycleFinancials/summarizeCycleFinancials already SUM
-- every entry for a cycle, so dropping this index alone is what lets
-- multiple paychecks accumulate correctly -- see lib/cycles.ts's
-- logPaycheckToOpenCycle. It's a plain unique INDEX, not a table
-- CONSTRAINT (verified via psql \d before writing this file -- Prisma's
-- @@unique compiles to CREATE UNIQUE INDEX, not ADD CONSTRAINT, so
-- pg_constraint has no row for it).
DROP INDEX "CycleIncomeEntry_cycleId_incomeSourceId_key";

-- receivedAt: the real date a paycheck landed, distinct from createdAt
-- (write time) -- needed to display/sort a MONTHLY cycle's multiple
-- logged paychecks. Backfilled from each row's own createdAt rather than
-- left to the column default: a bulk `now()`/CURRENT_TIMESTAMP default
-- is evaluated once at ALTER TABLE time, which would incorrectly stamp
-- every pre-existing row with this migration's apply-time instead of its
-- real original date.
ALTER TABLE "CycleIncomeEntry" ADD COLUMN "receivedAt" TIMESTAMP(3);
UPDATE "CycleIncomeEntry" SET "receivedAt" = "createdAt";
ALTER TABLE "CycleIncomeEntry" ALTER COLUMN "receivedAt" SET NOT NULL;
ALTER TABLE "CycleIncomeEntry" ALTER COLUMN "receivedAt" SET DEFAULT CURRENT_TIMESTAMP;
