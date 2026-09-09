"use client";

import Sparkline from "@/app/(app)/_components/charts/Sparkline";
import PageTransitionLink from "@/app/(app)/_components/PageTransitionLink";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummarySparklineRowProps {
  cycleId: string;
  /** Real trailing-cycle spend, oldest first -- however many closed cycles actually exist. */
  points: number[];
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummarySparklineRow({ cycleId, points, vocab, t }: SummarySparklineRowProps) {
  return (
    <PageTransitionLink
      href={`/transactions/breakdown?cycle=${cycleId}`}
      className="summary-sparkline-row"
    >
      <div className="summary-sparkline-content">
        <Sparkline points={points} colorVar="--color-savings" />
        <span className="summary-sparkline-label">{t.summary.sparklineLabel(vocab, points.length)}</span>
      </div>
      <span className="summary-sparkline-chevron">›</span>
    </PageTransitionLink>
  );
}
