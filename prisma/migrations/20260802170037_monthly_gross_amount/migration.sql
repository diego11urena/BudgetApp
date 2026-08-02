-- RenameColumn: onboarding now collects Monthly Gross Salary (how Panama
-- employment contracts actually quote pay) and derives the quincena split
-- from it, rather than asking for the per-quincena amount directly.
ALTER TABLE "IncomeSource" RENAME COLUMN "grossAmountPerCycle" TO "grossMonthlyAmount";
