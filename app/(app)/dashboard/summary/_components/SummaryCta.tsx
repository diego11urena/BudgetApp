"use client";

import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummaryCtaProps {
  onStartNextPeriod: () => void;
  onSeeFullBreakdown: () => void;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummaryCta({
  onStartNextPeriod,
  onSeeFullBreakdown,
  vocab,
  t,
}: SummaryCtaProps) {
  return (
    <div className="summary-cta">
      <button className="summary-cta-primary" onClick={onStartNextPeriod}>
        {t.summary.ctaStart(vocab)}
      </button>
      <button className="summary-cta-secondary" onClick={onSeeFullBreakdown}>
        {t.summary.seeFullBreakdown}
      </button>
    </div>
  );
}
