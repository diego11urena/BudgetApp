"use client";

import RecurringFulfillmentCard from "@/app/(app)/_components/RecurringFulfillmentCard";
import { useT } from "@/app/_components/LocaleProvider";
import type { RecurringFulfillment } from "@/lib/recurring-fulfillment";

/**
 * Chapter 02 — "How this quincena's recurring items did." Same card
 * Summary's own Recurring section shows (RecurringFulfillmentCard).
 */
export default function RecurringChapter({ fulfillment }: { fulfillment: RecurringFulfillment }) {
  const t = useT();
  return <RecurringFulfillmentCard fulfillment={fulfillment} t={t} />;
}
