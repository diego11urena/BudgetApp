import Link from "next/link";
import RecurringFulfillmentCard from "@/app/(app)/_components/RecurringFulfillmentCard";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryRecurringSectionProps {
  fulfillment: RecurringFulfillment;
  t: Dictionary;
}

/**
 * Shared with Breakdown's chapter 02 via RecurringFulfillmentCard.
 */
export default function SummaryRecurringSection({ fulfillment, t }: SummaryRecurringSectionProps) {
  return (
    <section className="summary-recurring-section">
      <h2 className="summary-section-eyebrow">{t.summary.scheduledEyebrow}</h2>

      <Link href="/plan" className="summary-recurring-row">
        <RecurringFulfillmentCard fulfillment={fulfillment} t={t} />
      </Link>
    </section>
  );
}
