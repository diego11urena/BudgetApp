-- Collapses IncomeFrequency.BIWEEKLY into SEMIMONTHLY ("twice a month") --
-- the app no longer distinguishes a fixed twice-a-month payday from a
-- floating every-14-days one for pay frequency (that distinction still
-- exists, unrelated, on RecurringExpense/ExpenseCategory.frequency's own
-- RecurringFrequency enum -- not touched here).
--
-- Normalize existing rows BEFORE swapping the enum type -- Postgres has no
-- ALTER TYPE ... DROP VALUE, so removing a value means recreating the type
-- without it and moving the column over, which fails if any row still
-- holds the value being dropped.
UPDATE "User" SET "payFrequency" = 'SEMIMONTHLY' WHERE "payFrequency" = 'BIWEEKLY';

CREATE TYPE "IncomeFrequency_new" AS ENUM ('MONTHLY', 'SEMIMONTHLY');

ALTER TABLE "User" ALTER COLUMN "payFrequency" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "payFrequency" TYPE "IncomeFrequency_new" USING ("payFrequency"::text::"IncomeFrequency_new");
ALTER TABLE "User" ALTER COLUMN "payFrequency" SET DEFAULT 'SEMIMONTHLY';

DROP TYPE "IncomeFrequency";
ALTER TYPE "IncomeFrequency_new" RENAME TO "IncomeFrequency";

-- Newly-enforced invariant (app code, not a DB constraint): payFrequency
-- MONTHLY implies budgetFrequency MONTHLY -- a once-a-month earner has no
-- second paycheck to split a quincena around. Existing rows written before
-- this rule existed could already violate it (onboarding briefly allowed
-- any combination); correct them here so the invariant is true for every
-- row from this migration forward, not just newly-written ones.
UPDATE "User" SET "budgetFrequency" = 'MONTHLY' WHERE "payFrequency" = 'MONTHLY' AND "budgetFrequency" = 'QUINCENAL';
