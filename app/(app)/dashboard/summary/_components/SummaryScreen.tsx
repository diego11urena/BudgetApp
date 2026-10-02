"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { CycleFinancials } from "@/lib/cycle-financials";
import type { GoalWithProgress } from "@/lib/goals";
import type { SpendComparison, UncategorizedWarning } from "@/lib/summary";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";
import { formatCurrency, formatWholeDollars } from "@/lib/format";
import { useT, useVocab } from "@/app/_components/LocaleProvider";
import SummaryHeadline from "./SummaryHeadline";
import SummaryContextLine from "./SummaryContextLine";
import SummaryStatRow from "./SummaryStatRow";
import SummaryGoalsSection from "./SummaryGoalsSection";
import SummaryRecurringSection from "./SummaryRecurringSection";
import SummarySparklineRow from "./SummarySparklineRow";
import SummaryUncategorizedStrip from "./SummaryUncategorizedStrip";
import SummaryCta from "./SummaryCta";

interface SummaryScreenProps {
  cycleId: string;
  cycleRangeText: string;
  /** The period this summary hands off to, for the CTA's label. Null when there's no open cycle to name. */
  nextCycleRangeText: string | null;
  financials: CycleFinancials;
  goalsWithProgress: GoalWithProgress[];
  recurringFulfillment: RecurringFulfillment;
  comparison: Partial<SpendComparison> | null;
  sparklinePoints: number[];
  uncategorized: UncategorizedWarning | null;
}

export default function SummaryScreen({
  cycleId,
  cycleRangeText,
  nextCycleRangeText,
  financials,
  goalsWithProgress,
  recurringFulfillment,
  comparison,
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
        {/* Summary only ever shows a closed cycle (there's no LIVE variant
            of this screen) -- reusing Breakdown's own closedEyebrow
            template ("{range} · closed") rather than a duplicate key,
            per the design spec's literal kicker "AUG 16 – AUG 31 · CLOSED". */}
        <p className="summary-header-eyebrow">{t.breakdown.closedEyebrow(cycleRangeText)}</p>
      </header>

      {/* Whole dollars here only -- the design system's type notes put
          headlines on whole dollars while every other figure, including
          the stat row just below, keeps its cents. */}
      <SummaryHeadline
        spent={formatWholeDollars(financials.totalExpenses)}
        saved={formatWholeDollars(financials.totalSavings)}
        t={t}
        vocab={vocab}
      />

      <SummaryContextLine comparison={comparison} t={t} vocab={vocab} />

      <SummaryStatRow
        income={formatCurrency(financials.baseIncome + financials.extraIncome)}
        spent={formatCurrency(financials.totalExpenses)}
        saved={formatCurrency(financials.totalSavings)}
        t={t}
      />

      {/* Only drawn once there's actual history to draw -- a single closed
          cycle is a dot, and zero is nothing at all rather than an invented
          trend line. */}
      {sparklinePoints.length > 0 && (
        <SummarySparklineRow cycleId={cycleId} points={sparklinePoints} vocab={vocab} t={t} />
      )}

      {goalsWithProgress.length > 0 && <SummaryGoalsSection goals={goalsWithProgress} t={t} />}

      {recurringFulfillment.scheduled.total > 0 && (
        <SummaryRecurringSection fulfillment={recurringFulfillment} t={t} />
      )}

      {uncategorized && <SummaryUncategorizedStrip warning={uncategorized} t={t} />}

      <SummaryCta cycleId={cycleId} nextCycleRangeText={nextCycleRangeText} vocab={vocab} t={t} />
    </div>
  );
}
