-- Enforces "at most one open (DRAFT/ACTIVE) BudgetCycle per user" at the
-- database level. getOrCreateDraftCycle's prior findFirst-then-create was
-- a classic TOCTOU race: two concurrent calls (two browser tabs, a
-- retried request, or React dev-mode's double render) could both see no
-- existing open cycle and both create one. This partial unique index
-- makes a second concurrent INSERT impossible -- the losing transaction
-- gets a P2002 unique-violation instead of a duplicate row (see
-- lib/cycles.ts's getOrCreateDraftCycle, which now catches it and
-- re-reads the winner).
CREATE UNIQUE INDEX "BudgetCycle_one_open_per_user"
  ON "BudgetCycle" ("userId")
  WHERE status IN ('DRAFT', 'ACTIVE');

-- Enforces "at most one active IncomeSource per user" -- saveIncomeAction
-- (onboarding's income step) had the same findFirst-then-create race for
-- a user's first IncomeSource row, with no constraint at all backing it
-- before this. Same fix shape as above.
CREATE UNIQUE INDEX "IncomeSource_one_active_per_user"
  ON "IncomeSource" ("userId")
  WHERE "isActive" = true;

-- Enforces case-insensitive uniqueness of (userId, name, type) for
-- ExpenseCategory. getOrCreateCategory does a case-insensitive lookup
-- ("Rent" and "rent" are the same category) but the schema-native
-- @@unique([userId, name, type]) constraint (kept as-is below) is
-- case-sensitive and can't back that -- "Rent" and "rent" satisfy it as
-- two distinct rows. This expression index closes the gap without
-- touching the existing case-sensitive constraint, which other code
-- (goals/budget upserts, via Prisma's generated userId_name_type compound
-- input) still relies on.
CREATE UNIQUE INDEX "ExpenseCategory_userId_name_ci_type_key"
  ON "ExpenseCategory" ("userId", LOWER(name), "type");

-- NOTE: none of the three indexes above are representable in
-- schema.prisma -- the Prisma schema DSL has no syntax for partial
-- (WHERE-filtered) or expression (LOWER(...)) indexes. `prisma migrate
-- dev` computes new migrations by diffing schema.prisma against the
-- shadow database rebuilt from migration history, not the live DB, so a
-- future migration-generation run that doesn't know about these will see
-- them as "drift" and may propose DROP INDEX statements to reconcile.
-- If that happens, strip those DROPs from the generated migration rather
-- than applying them -- these three indexes are the actual concurrency
-- fix, not incidental structure.
