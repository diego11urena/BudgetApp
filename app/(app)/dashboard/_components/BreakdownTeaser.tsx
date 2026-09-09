import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";

/**
 * Home's only entry point into the LIVE Breakdown screen (the CLOSED one is
 * reached from Summary and from History's cycle detail). A server component
 * -- the dictionary is handed down from dashboard/page.tsx directly, which
 * is only safe because nothing here is "use client".
 */
export default function BreakdownTeaser({ t, vocab }: { t: Dictionary; vocab: PeriodVocab }) {
  return (
    <Link href="/transactions/breakdown" className="breakdown-teaser">
      <div className="breakdown-teaser-content">
        <h3>{t.dashboard.breakdownTeaserTitle}</h3>
        <p>{t.dashboard.breakdownTeaserBody(vocab)}</p>
      </div>
      <ChevronRight size={18} className="breakdown-teaser-chevron" aria-hidden="true" />
    </Link>
  );
}
