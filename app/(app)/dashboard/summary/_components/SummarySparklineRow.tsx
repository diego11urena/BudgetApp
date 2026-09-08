"use client";

import Sparkline from "@/app/(app)/_components/charts/Sparkline";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummarySparklineRowProps {
  cycleId: string;
  onTap: () => void;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummarySparklineRow({
  cycleId,
  onTap,
  vocab,
  t,
}: SummarySparklineRowProps) {
  // TODO: Fetch trailing cycle data and compute sparkline points
  const samplePoints = [500, 550, 600, 575, 625, 594];

  return (
    <button className="summary-sparkline-row" onClick={onTap}>
      <div className="summary-sparkline-content">
        <Sparkline points={samplePoints} colorVar="--color-savings" />
        <span className="summary-sparkline-label">{t.summary.sparklineLabel(vocab, 6)}</span>
      </div>
      <span className="summary-sparkline-chevron">›</span>
    </button>
  );
}
