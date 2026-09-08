"use client";

import { useRouter } from "next/navigation";
import PageTransitionLink from "@/app/(app)/_components/PageTransitionLink";
import type { PeriodVocab, Dictionary } from "@/lib/i18n/dictionary";

interface SummaryCtaProps {
  cycleId: string;
  vocab: PeriodVocab;
  t: Dictionary;
}

export default function SummaryCta({
  cycleId,
  vocab,
  t,
}: SummaryCtaProps) {
  const router = useRouter();

  return (
    <div className="summary-cta">
      <button
        className="summary-cta-primary"
        onClick={() => router.push("/dashboard")}
      >
        {t.summary.ctaStart(vocab)}
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
