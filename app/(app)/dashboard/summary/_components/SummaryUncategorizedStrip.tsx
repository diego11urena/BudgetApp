import Link from "next/link";
import type { UncategorizedWarning } from "@/lib/summary";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatCurrency } from "@/lib/format";

/**
 * The amber "n transactions still need a category" strip. The fix
 * affordance is a real Link to Activity (where categorizing actually
 * happens) rather than a bare <button> with no handler.
 */
export default function SummaryUncategorizedStrip({
  warning,
  t,
}: {
  warning: UncategorizedWarning;
  t: Dictionary;
}) {
  return (
    <Link href="/transactions?category=uncategorized" className="summary-uncategorized-strip">
      <span className="summary-uncategorized-dot" aria-hidden="true" />
      <span className="summary-uncategorized-text">
        {t.summary.uncategorizedWarning(warning.count, formatCurrency(warning.totalAmount))}
      </span>
      <span className="summary-uncategorized-fix">{t.summary.fixAction}</span>
    </Link>
  );
}
