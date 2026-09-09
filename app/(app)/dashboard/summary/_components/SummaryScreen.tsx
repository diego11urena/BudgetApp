"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { CycleFinancials } from "@/lib/cycle-financials";
import type { GoalWithProgress } from "@/lib/goals";
import type { UncategorizedWarning } from "@/lib/summary";
import { formatCurrency } from "@/lib/format";
import { useT, useVocab } from "@/app/_components/LocaleProvider";
import SummaryHeadline from "./SummaryHeadline";
import SummaryStatRow from "./SummaryStatRow";
import SummaryGoalsSection from "./SummaryGoalsSection";
import SummaryBillsSection from "./SummaryBillsSection";
import SummarySparklineRow from "./SummarySparklineRow";
import SummaryUncategorizedStrip from "./SummaryUncategorizedStrip";
import SummaryCta from "./SummaryCta";

interface SummaryScreenProps {
  cycleId: string;
  cycleRangeText: string;
  financials: CycleFinancials;
  goalsWithProgress: GoalWithProgress[];
  billsPaidCount: number;
  billsTotalCount: number;
  billsLateCount: number;
  sparklinePoints: number[];
  uncategorized: UncategorizedWarning | null;
}

export default function SummaryScreen({
  cycleId,
  cycleRangeText,
  financials,
  goalsWithProgress,
  billsPaidCount,
  billsTotalCount,
  billsLateCount,
  sparklinePoints,
  uncategorized,
}: SummaryScreenProps) {
  const router = useRouter();
  const t = useT();
  const vocab = useVocab();

  return (
    <div className="summary-screen">
      <header className="summary-header">
        <button
          type="button"
          className="summary-header-back"
          onClick={() => router.back()}
          aria-label={t.common.back}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <p className="summary-header-eyebrow">{cycleRangeText}</p>
      </header>

      <SummaryHeadline
        headline={t.summary.headline(
          vocab,
          formatCurrency(financials.totalExpenses),
          formatCurrency(financials.amountLeft),
        )}
      />

      <SummaryStatRow
        income={formatCurrency(financials.baseIncome + financials.extraIncome)}
        spent={formatCurrency(financials.totalExpenses)}
        leftOver={formatCurrency(financials.amountLeft)}
        t={t}
      />

      {/* Only drawn once there's actual history to draw -- a single closed
          cycle is a dot, and zero is nothing at all rather than an invented
          trend line. */}
      {sparklinePoints.length > 0 && (
        <SummarySparklineRow cycleId={cycleId} points={sparklinePoints} vocab={vocab} t={t} />
      )}

      {goalsWithProgress.length > 0 && <SummaryGoalsSection goals={goalsWithProgress} t={t} />}

      {billsTotalCount > 0 && (
        <SummaryBillsSection
          paidCount={billsPaidCount}
          totalCount={billsTotalCount}
          lateCount={billsLateCount}
          t={t}
        />
      )}

      {uncategorized && <SummaryUncategorizedStrip warning={uncategorized} t={t} />}

      <SummaryCta cycleId={cycleId} vocab={vocab} t={t} />
    </div>
  );
}
