-- DropIndex
DROP INDEX "BudgetCycle_userId_label_key";

-- AlterTable
ALTER TABLE "BudgetCycle" ALTER COLUMN "periodEnd" DROP NOT NULL;
