-- IncomeSource: replace grossMonthlyAmount + isPanamaPayroll with a single
-- directly-entered netQuincenaAmount (no more gross/deduction calculation).
ALTER TABLE "IncomeSource" ADD COLUMN "netQuincenaAmount" DECIMAL(12,2);
UPDATE "IncomeSource" SET "netQuincenaAmount" = 0;
ALTER TABLE "IncomeSource" ALTER COLUMN "netQuincenaAmount" SET NOT NULL;
ALTER TABLE "IncomeSource" DROP COLUMN "grossMonthlyAmount";
ALTER TABLE "IncomeSource" DROP COLUMN "isPanamaPayroll";

-- CycleIncomeEntry: drop every deduction/decimo field -- only netAmount was
-- ever read downstream. The decimo* columns were already fully dead code.
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "grossAmount";
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "cssDeduction";
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "seguroEducativoDeduction";
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "isrDeduction";
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "decimoGrossAmount";
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "decimoCssDeduction";
ALTER TABLE "CycleIncomeEntry" DROP COLUMN "decimoIsEstimated";
