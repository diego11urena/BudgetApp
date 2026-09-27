"use client";

import RecurringFulfillmentCard from "@/app/(app)/_components/RecurringFulfillmentCard";
import { useT } from "@/app/_components/LocaleProvider";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";

/**
 * Chapter 02 — "How this quincena's recurring items did." Same
 * Scheduled/Ongoing structure Summary's own Recurring section shows
 * (RecurringFulfillmentCard, shared by both), just without the progress
 * bar — these items already make up the Fixed number in chapter 01, so a
 * second bar here would just repeat that segment's own width.
 */
export default function RecurringChapter({ fulfillment, live }: { fulfillment: RecurringFulfillment; live: boolean }) {
  const t = useT();
  return <RecurringFulfillmentCard fulfillment={fulfillment} t={t} showProgressBar={false} live={live} />;
}
