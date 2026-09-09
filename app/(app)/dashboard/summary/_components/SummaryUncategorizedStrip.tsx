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
    <div className="summary-uncategorized-strip">
      <span>{t.summary.uncategorizedWarning(warning.count, formatCurrency(warning.totalAmount))}</span>
      <Link href="/transactions" className="summary-uncategorized-fix">
        {t.summary.fixAction}
      </Link>
    </div>
  );
}
