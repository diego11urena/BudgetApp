"use client";

import { ProgressBar } from "./ProgressBar";
import { useLocale } from "@/app/_components/LocaleProvider";
import { formatShortDate } from "@/lib/format";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Scheduled/Ongoing recurring-item status, shared by Summary's Recurring
 * section and Breakdown's chapter 02 -- one component so the two screens
 * can never render different copy for the same underlying
 * RecurringFulfillment (see lib/recurring-fulfillment.ts's own doc
 * comment for why the data layer is shared too).
 *
 * showProgressBar is the one real difference between the two call sites:
 * Summary's spec keeps a 6px on-track bar under the Scheduled status line;
 * Breakdown's chapter 02 spec explicitly says "no progress bar here" (its
 * Scheduled figures already show up as chapter 01's Fixed segment).
 */
export default function RecurringFulfillmentCard({
  fulfillment,
  t,
  showProgressBar,
  live,
}: {
  fulfillment: RecurringFulfillment;
  t: Dictionary;
  showProgressBar: boolean;
  live: boolean;
}) {
  const locale = useLocale();
  const { scheduled, ongoing } = fulfillment;

  const exceptionText = scheduled.exception
    ? scheduled.exception.kind === "missing"
      ? t.recurringFulfillment.missing(scheduled.exception.name)
      : t.recurringFulfillment.upcoming(
          scheduled.exception.name,
          scheduled.exception.dueDate ? formatShortDate(scheduled.exception.dueDate) : ""
        )
    : t.recurringFulfillment.allChargedOnTime;

  return (
    <div className="recurring-fulfillment-card">
      <div className="recurring-fulfillment-row">
        <span className="recurring-fulfillment-swatch" aria-hidden="true" />
        <div className="recurring-fulfillment-content">
          <p className="recurring-fulfillment-status">{t.recurringFulfillment.chargedOnTime(scheduled.chargedOnTime, scheduled.total)}</p>
          {showProgressBar && (
            <div className="recurring-fulfillment-progress">
              <ProgressBar current={scheduled.chargedOnTime} target={scheduled.total} colorState="good" />
            </div>
          )}
          <p className="recurring-fulfillment-subline">{exceptionText}</p>
        </div>
      </div>

      {ongoing.loggedNames.length > 0 && (
        <>
          <div className="recurring-fulfillment-divider" />
          <div className="recurring-fulfillment-row">
            <span className="recurring-fulfillment-swatch" aria-hidden="true" />
            <p className="recurring-fulfillment-subline">
              {t.recurringFulfillment.ongoingLogged(
                new Intl.ListFormat(locale === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(ongoing.loggedNames),
                live
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
