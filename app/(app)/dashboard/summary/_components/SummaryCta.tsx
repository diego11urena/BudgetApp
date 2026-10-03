"use client";

import { useRouter } from "next/navigation";
import PageTransitionLink from "@/app/(app)/_components/PageTransitionLink";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummaryCtaProps {
  cycleId: string;
  nextCycleRangeText: string | null;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummaryCta({
  cycleId,
  nextCycleRangeText,
  vocab,
  t,
}: SummaryCtaProps) {
  const router = useRouter();

  return (
    <div className="summary-cta">
      <button
        type="button"
        className="button summary-cta-primary"
        onClick={() => router.push("/dashboard")}
      >
        {/* Name the period being started when we know it ("Start Sep 1 -
            Sep 15"); fall back to the generic label when there's no open
            cycle to name (see the page's own comment). */}
        {nextCycleRangeText ? t.summary.ctaStartRange(nextCycleRangeText) : t.summary.ctaStart(vocab)}
      </button>
      <PageTransitionLink
        href={`/transactions/breakdown?cycle=${cycleId}`}
        className="summary-cta-secondary"
      >
        {t.summary.seeFullBreakdown}
      </PageTransitionLink>
    </div>
  );
}
