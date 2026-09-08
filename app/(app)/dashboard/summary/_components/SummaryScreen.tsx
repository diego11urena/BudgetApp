"use client";

import { useRouter } from "next/navigation";
import type { BudgetCycle } from "@/app/generated/prisma/client";
import type { CycleFinancials } from "@/lib/cycle-financials";
import type { GoalWithProgress } from "@/lib/goals";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";
import type { BudgetFrequency } from "@/lib/quincena-pace";
import { formatCurrency } from "@/lib/format";
import SummaryHeadline from "./SummaryHeadline";
import SummaryStatRow from "./SummaryStatRow";
import SummaryGoalsSection from "./SummaryGoalsSection";
import SummaryBillsSection from "./SummaryBillsSection";
import SummarySparklineRow from "./SummarySparklineRow";
import SummaryUncategorizedStrip from "./SummaryUncategorizedStrip";
import SummaryCta from "./SummaryCta";

interface SummaryScreenProps {
  cycle: BudgetCycle;
  cycleLabel: string;
  cycleRangeText: string;
  budgetFrequency: BudgetFrequency;
  financials: CycleFinancials;
  goalsWithProgress: GoalWithProgress[];
  prevCycle: BudgetCycle | null;
  nextCycle: BudgetCycle | null;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummaryScreen({
  cycle,
  cycleLabel,
  cycleRangeText,
  budgetFrequency,
  financials,
  goalsWithProgress,
  prevCycle,
  nextCycle,
  vocab,
  t,
}: SummaryScreenProps) {
  const router = useRouter();

  const handleNavigateToBreakdown = () => {
    router.push(`/transactions/breakdown?cycle=${cycle.id}`);
  };

  return (
    <div className="summary-screen">
      {/* Eyebrow + back chevron */}
      <button
        className="summary-header-back"
        onClick={() => router.back()}
        aria-label={t.common.back}
      >
        ‹
      </button>

      {/* Headline + financials */}
      <SummaryHeadline
        spent={formatCurrency(financials.totalExpenses)}
        leftOver={formatCurrency(financials.amountLeft)}
        vocab={vocab}
        t={t}
      />

      {/* Stats row: Income / Spent / Left Over */}
      <SummaryStatRow
        income={formatCurrency(financials.baseIncome + financials.extraIncome)}
        spent={formatCurrency(financials.totalExpenses)}
        leftOver={formatCurrency(financials.amountLeft)}
        t={t}
      />

      {/* Sparkline row (tappable) */}
      <SummarySparklineRow
        cycleId={cycle.id}
        onTap={handleNavigateToBreakdown}
        vocab={vocab}
        t={t}
      />

      {/* Goals section */}
      <SummaryGoalsSection goals={goalsWithProgress} t={t} />

      {/* Bills section */}
      <SummaryBillsSection cycleId={cycle.id} t={t} />

      {/* Uncategorized warning (if any) */}
      <SummaryUncategorizedStrip financials={financials} t={t} />

      {/* CTA row */}
      <SummaryCta
        onStartNextPeriod={() => router.push("/dashboard")}
        onSeeFullBreakdown={handleNavigateToBreakdown}
        vocab={vocab}
        t={t}
      />
    </div>
  );
}
