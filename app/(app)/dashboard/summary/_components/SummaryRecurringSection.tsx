import Link from "next/link";
import { ChevronRight } from "lucide-react";
import RecurringFulfillmentCard from "@/app/(app)/_components/RecurringFulfillmentCard";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryRecurringSectionProps {
  fulfillment: RecurringFulfillment;
  t: Dictionary;
}

/**
 * Now shared with Breakdown's chapter 02 via RecurringFulfillmentCard --
 * Summary is the one call site that keeps the on-track progress bar (see
 * that component's own doc comment for why), and is the one that adds
 * the Ongoing subline the old Scheduled-only version here never showed.
 */
export default function SummaryRecurringSection({ fulfillment, t }: SummaryRecurringSectionProps) {
  return (
    <section className="summary-recurring-section">
      <h2 className="summary-section-eyebrow">{t.summary.scheduledEyebrow}</h2>

      <Link href="/plan" className="summary-recurring-row">
        <div className="summary-recurring-content">
          <RecurringFulfillmentCard fulfillment={fulfillment} t={t} showProgressBar={true} live={false} />
        </div>
        <ChevronRight size={18} className="summary-recurring-chevron" aria-hidden="true" />
      </Link>
    </section>
  );
}
