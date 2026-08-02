-- RenameColumn: the app now works entirely in quincena (15-day) pay cycles,
-- not monthly amounts, so this column's meaning changes accordingly.
ALTER TABLE "IncomeSource" RENAME COLUMN "grossMonthlyAmount" TO "grossAmountPerCycle";

-- AlterTable: payFrequency was never read anywhere in application code, and
-- defaulting to MONTHLY would now be actively misleading.
ALTER TABLE "IncomeSource" DROP COLUMN "payFrequency";

-- DropEnum
DROP TYPE "PayFrequency";
