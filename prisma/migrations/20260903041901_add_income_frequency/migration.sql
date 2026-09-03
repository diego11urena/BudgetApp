-- Genuinely new, separate concept: how often the user actually receives a
-- paycheck ("once a month" / "twice a month" / "biweekly"). Deliberately
-- does not drive any cycle-boundary or comparison calculation -- see
-- budgetFrequency (renamed by the prior migration) for that. Default
-- SEMIMONTHLY matches what every existing account has implicitly been
-- (quincena = paid twice a month); the guess has zero functional effect
-- either way since nothing reads this into a calculation.
CREATE TYPE "IncomeFrequency" AS ENUM ('MONTHLY', 'SEMIMONTHLY', 'BIWEEKLY');
ALTER TABLE "User" ADD COLUMN "payFrequency" "IncomeFrequency" NOT NULL DEFAULT 'SEMIMONTHLY';
