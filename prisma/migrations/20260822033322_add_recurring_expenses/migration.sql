-- AlterTable
ALTER TABLE "CycleTransaction" ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "RecurringFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "dueDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleRecurringExpense" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleRecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_categoryId_idx" ON "RecurringExpense"("categoryId");

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_idx" ON "RecurringExpense"("userId");

-- CreateIndex
CREATE INDEX "CycleRecurringExpense_cycleId_idx" ON "CycleRecurringExpense"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleRecurringExpense_cycleId_recurringExpenseId_key" ON "CycleRecurringExpense"("cycleId", "recurringExpenseId");

-- CreateIndex
CREATE INDEX "CycleTransaction_recurringExpenseId_idx" ON "CycleTransaction"("recurringExpenseId");

-- AddForeignKey
ALTER TABLE "CycleTransaction" ADD CONSTRAINT "CycleTransaction_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleRecurringExpense" ADD CONSTRAINT "CycleRecurringExpense_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "BudgetCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleRecurringExpense" ADD CONSTRAINT "CycleRecurringExpense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
