-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'SEMIMONTHLY');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('EXPENSE', 'SAVINGS');

-- CreateEnum
CREATE TYPE "FinancialAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD', 'LOAN', 'OTHER_DEBT');

-- CreateEnum
CREATE TYPE "BalanceSnapshotType" AS ENUM ('OPENING', 'CLOSING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "name" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grossMonthlyAmount" DECIMAL(12,2) NOT NULL,
    "payFrequency" "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "isPanamaPayroll" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleIncomeEntry" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "incomeSourceId" TEXT,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "cssDeduction" DECIMAL(12,2) NOT NULL,
    "seguroEducativoDeduction" DECIMAL(12,2) NOT NULL,
    "isrDeduction" DECIMAL(12,2) NOT NULL,
    "decimoGrossAmount" DECIMAL(12,2),
    "decimoCssDeduction" DECIMAL(12,2),
    "decimoIsEstimated" BOOLEAN NOT NULL DEFAULT false,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleIncomeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL DEFAULT 'EXPENSE',
    "icon" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleBudgetGoal" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "expenseCategoryId" TEXT NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleBudgetGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleAccountBalance" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "type" "BalanceSnapshotType" NOT NULL DEFAULT 'OPENING',
    "amount" DECIMAL(12,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleAccountBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "IncomeSource_userId_idx" ON "IncomeSource"("userId");

-- CreateIndex
CREATE INDEX "BudgetCycle_userId_periodStart_idx" ON "BudgetCycle"("userId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetCycle_userId_label_key" ON "BudgetCycle"("userId", "label");

-- CreateIndex
CREATE INDEX "CycleIncomeEntry_cycleId_idx" ON "CycleIncomeEntry"("cycleId");

-- CreateIndex
CREATE INDEX "CycleIncomeEntry_incomeSourceId_idx" ON "CycleIncomeEntry"("incomeSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_userId_name_key" ON "ExpenseCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "CycleBudgetGoal_cycleId_idx" ON "CycleBudgetGoal"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleBudgetGoal_cycleId_expenseCategoryId_key" ON "CycleBudgetGoal"("cycleId", "expenseCategoryId");

-- CreateIndex
CREATE INDEX "FinancialAccount_userId_idx" ON "FinancialAccount"("userId");

-- CreateIndex
CREATE INDEX "CycleAccountBalance_cycleId_idx" ON "CycleAccountBalance"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "CycleAccountBalance_cycleId_financialAccountId_type_key" ON "CycleAccountBalance"("cycleId", "financialAccountId", "type");

-- AddForeignKey
ALTER TABLE "IncomeSource" ADD CONSTRAINT "IncomeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCycle" ADD CONSTRAINT "BudgetCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleIncomeEntry" ADD CONSTRAINT "CycleIncomeEntry_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "BudgetCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleIncomeEntry" ADD CONSTRAINT "CycleIncomeEntry_incomeSourceId_fkey" FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleBudgetGoal" ADD CONSTRAINT "CycleBudgetGoal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "BudgetCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleBudgetGoal" ADD CONSTRAINT "CycleBudgetGoal_expenseCategoryId_fkey" FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleAccountBalance" ADD CONSTRAINT "CycleAccountBalance_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "BudgetCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleAccountBalance" ADD CONSTRAINT "CycleAccountBalance_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
