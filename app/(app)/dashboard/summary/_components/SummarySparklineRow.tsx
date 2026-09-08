"use client";

import Sparkline from "@/app/(app)/_components/charts/Sparkline";
import PageTransitionLink from "@/app/(app)/_components/PageTransitionLink";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummarySparklineRowProps {
  cycleId: string;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummarySparklineRow({
  cycleId,
  vocab,
  t,
}: SummarySparklineRowProps) {
  // TODO: Fetch trailing cycle data and compute sparkline points
  const samplePoints = [500, 550, 600, 575, 625, 594];

  return (
    <PageTransitionLink
      href={`/transactions/breakdown?cycle=${cycleId}`}
      className="summary-sparkline-row"
    >
      <div className="summary-sparkline-content">
        <Sparkline points={samplePoints} colorVar="--color-savings" />
        <span className="summary-sparkline-label">{t.summary.sparklineLabel(vocab, 6)}</span>
      </div>
      <span className="summary-sparkline-chevron">›</span>
    </PageTransitionLink>
  );
}
