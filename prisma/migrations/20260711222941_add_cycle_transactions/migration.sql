-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'SAVINGS');

-- CreateTable
CREATE TABLE "CycleTransaction" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expenseCategoryId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CycleTransaction_cycleId_idx" ON "CycleTransaction"("cycleId");

-- CreateIndex
CREATE INDEX "CycleTransaction_expenseCategoryId_idx" ON "CycleTransaction"("expenseCategoryId");

-- AddForeignKey
ALTER TABLE "CycleTransaction" ADD CONSTRAINT "CycleTransaction_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "BudgetCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleTransaction" ADD CONSTRAINT "CycleTransaction_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
