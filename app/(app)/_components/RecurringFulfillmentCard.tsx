"use client";

import { ProgressBar } from "./ProgressBar";
import { useLocale } from "@/app/_components/LocaleProvider";
import { formatShortDate } from "@/lib/format";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Recurring-item status, shared by Summary's Recurring section and
 * Breakdown's chapter 02 -- one component so the two screens can never
 * render different copy for the same underlying RecurringFulfillment (see
 * lib/recurring-fulfillment.ts's own doc comment for why the data layer
 * is shared too).
 */
export default function RecurringFulfillmentCard({
  fulfillment,
  t,
}: {
  fulfillment: RecurringFulfillment;
  t: Dictionary;
}) {
  const locale = useLocale();
  const { chargedOnTime, total, exception } = fulfillment;

  const exceptionText = exception
    ? exception.kind === "missing"
      ? t.recurringFulfillment.missing(exception.name)
      : t.recurringFulfillment.upcoming(
          exception.name,
          exception.dueDate ? formatShortDate(exception.dueDate, locale) : ""
        )
    : t.recurringFulfillment.allChargedOnTime;

  // DESIGN.md S6 "Recurring row": gold swatch + label, gold "N of N ..."
  // count, 6px gold bar, and a faint subline naming the exception.
  return (
    <div className="recurring-fulfillment-card">
      <div className="recurring-fulfillment-group">
        <div className="recurring-fulfillment-row">
          <span className="recurring-fulfillment-swatch" aria-hidden="true" />
          <span className="recurring-fulfillment-label">{t.recurringFulfillment.label}</span>
          <span className="recurring-fulfillment-status">{t.recurringFulfillment.chargedOnTime(chargedOnTime, total)}</span>
        </div>
        <div className="recurring-fulfillment-progress">
          <ProgressBar current={chargedOnTime} target={total} colorState="good" />
        </div>
        <p className="recurring-fulfillment-subline">{exceptionText}</p>
      </div>
    </div>
  );
}
