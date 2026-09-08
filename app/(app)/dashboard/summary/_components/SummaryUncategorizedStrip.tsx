import type { CycleFinancials } from "@/lib/cycle-financials";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { computeUncategorizedWarning } from "@/lib/summary";

interface SummaryUncategorizedStripProps {
  financials: CycleFinancials;
  t: Dictionary;
}

export default function SummaryUncategorizedStrip({
  financials,
  t,
}: SummaryUncategorizedStripProps) {
  const warning = computeUncategorizedWarning(financials);

  if (!warning) {
    return null;
  }

  return (
    <div className="summary-uncategorized-strip">
      <span>
        {t.summary.uncategorizedWarning(warning.count, `$${warning.totalAmount.toFixed(2)}`)}
      </span>
      <button className="summary-uncategorized-fix">{t.summary.fixAction}</button>
    </div>
  );
}
