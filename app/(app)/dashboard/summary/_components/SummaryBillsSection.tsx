import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryBillsSectionProps {
  paidCount: number;
  totalCount: number;
  /** Anything not fully paid when the cycle closed -- the confirmed rule for this screen. */
  lateCount: number;
  t: Dictionary;
}

export default function SummaryBillsSection({ paidCount, totalCount, lateCount, t }: SummaryBillsSectionProps) {
  // The caller only mounts this when totalCount > 0, but guard anyway --
  // a 0/0 cycle would otherwise put `width: NaN%` on the fill.
  const pct = totalCount > 0 ? Math.min(100, (paidCount / totalCount) * 100) : 0;

  return (
    <section className="summary-bills-section">
      <h2 className="summary-section-eyebrow">{t.summary.billsEyebrow}</h2>

      <Link href="/budget" className="summary-bills-row">
        <div className="summary-bills-content">
          <div className="summary-bills-label">{t.summary.billsPaidOnTime(paidCount, totalCount)}</div>
          <div className="summary-bills-track">
            <div className="summary-bills-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {lateCount > 0 && <div className="summary-bills-late-tag">{t.summary.billsLateTag(lateCount)}</div>}

        <ChevronRight size={18} className="summary-bills-chevron" aria-hidden="true" />
      </Link>
    </section>
  );
}
