-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'BANK_IMPORT', 'YAPPY');

-- AlterTable
ALTER TABLE "CycleTransaction" ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL';

-- Data migration: "Bank Import"/"Yappy" were never real categories, just a
-- system bucket standing in for import source. Recover that source onto
-- the new column and clear the fake category off every row that still has
-- it (a row already re-categorized by hand before this migration keeps its
-- real category untouched).
UPDATE "CycleTransaction" ct
SET "source" = 'BANK_IMPORT', "expenseCategoryId" = NULL
FROM "ExpenseCategory" ec
WHERE ct."expenseCategoryId" = ec.id AND ec.name = 'Bank Import' AND ec.type = 'EXPENSE';

UPDATE "CycleTransaction" ct
SET "source" = 'YAPPY', "expenseCategoryId" = NULL
FROM "ExpenseCategory" ec
WHERE ct."expenseCategoryId" = ec.id AND ec.name = 'Yappy' AND ec.type = 'EXPENSE';

-- Best-effort for a Gmail-imported row that was already manually
-- re-categorized (a real category, not the fake bucket) before this
-- migration ran, so the two updates above didn't touch it — there's no way
-- to recover which rail it came from at this point, so it defaults to the
-- more common case (a bank card purchase) rather than staying "Manual".
UPDATE "CycleTransaction"
SET "source" = 'BANK_IMPORT'
WHERE "sourceMessageId" IS NOT NULL AND "source" = 'MANUAL';

-- The fake system categories are now unreferenced by any transaction —
-- drop them so they can never again be selected/displayed as a category.
DELETE FROM "ExpenseCategory" WHERE name IN ('Bank Import', 'Yappy') AND type = 'EXPENSE';
