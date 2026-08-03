-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('BIWEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "ExpenseCategory"
  ADD COLUMN "frequency" "RecurringFrequency" NOT NULL DEFAULT 'BIWEEKLY',
  ADD COLUMN "dueDay" INTEGER;
