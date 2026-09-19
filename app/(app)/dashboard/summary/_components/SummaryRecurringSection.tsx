import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryRecurringSectionProps {
  paidCount: number;
  totalCount: number;
  /** Anything not fully paid when the cycle closed -- the confirmed rule for this screen. */
  lateCount: number;
  t: Dictionary;
}

/** Scheduled recurring expenses only -- both counts come from summarizeRecurringExpenses, which excludes Ongoing items from every total (see its own doc comment). An Ongoing item has no due date to be "on time" or "late" against, so this screen doesn't claim one either way for it. */
export default function SummaryRecurringSection({ paidCount, totalCount, lateCount, t }: SummaryRecurringSectionProps) {
  // The caller only mounts this when totalCount > 0, but guard anyway --
  // a 0/0 cycle would otherwise put `width: NaN%` on the fill.
  const pct = totalCount > 0 ? Math.min(100, (paidCount / totalCount) * 100) : 0;

  return (
    <section className="summary-recurring-section">
      <h2 className="summary-section-eyebrow">{t.summary.scheduledEyebrow}</h2>

      <Link href="/plan" className="summary-recurring-row">
        <div className="summary-recurring-content">
          <div className="summary-recurring-label">{t.summary.scheduledPaidOnTime(paidCount, totalCount)}</div>
          <div className="summary-recurring-track">
            <div className="summary-recurring-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {lateCount > 0 && <div className="summary-recurring-late-tag">{t.summary.scheduledLateTag(lateCount)}</div>}

        <ChevronRight size={18} className="summary-recurring-chevron" aria-hidden="true" />
      </Link>
    </section>
  );
}
