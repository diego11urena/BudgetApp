import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryBillsSectionProps {
  cycleId: string;
  t: Dictionary;
}

export default function SummaryBillsSection({ cycleId, t }: SummaryBillsSectionProps) {
  // TODO: Fetch bills data and compute on-time counts
  const paidCount = 3;
  const totalCount = 4;
  const lateCount = 1;

  return (
    <section className="summary-bills-section">
      <h2 className="summary-section-eyebrow">{t.summary.billsEyebrow}</h2>

      <Link href="/budget" className="summary-bills-row">
        <div className="summary-bills-content">
          <div className="summary-bills-label">{t.summary.billsPaidOnTime(paidCount, totalCount)}</div>
          <div className="summary-bills-track">
            <div className="summary-bills-fill" style={{ width: `${(paidCount / totalCount) * 100}%` }} />
          </div>
        </div>

        {lateCount > 0 && <div className="summary-bills-late-tag">{t.summary.billsLateTag(lateCount)}</div>}

        <span className="summary-bills-chevron">›</span>
      </Link>
    </section>
  );
}
