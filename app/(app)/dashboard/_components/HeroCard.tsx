"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/format";
import { computeQuincenaPace } from "@/lib/quincena-pace";
import { justGotPaidAction, type CycleClosedSummary } from "../actions";
import { CycleClosedCard } from "./CycleClosedCard";

export function HeroCard({
  amountLeft,
  periodStart,
  totalExpenses,
}: {
  amountLeft: number;
  periodStart: Date;
  totalExpenses: number;
}) {
  const [pending, setPending] = useState(false);
  const [closedSummary, setClosedSummary] = useState<CycleClosedSummary | null>(null);
  const isPositive = amountLeft >= 0;
  const pace = computeQuincenaPace({ periodStart, now: new Date(), amountLeft, totalExpenses });

  async function handleJustGotPaid() {
    setPending(true);
    const summary = await justGotPaidAction();
    setPending(false);
    setClosedSummary(summary);
  }

  return (
    <>
      <div className="hero-card">
        <p className="hero-label">Available to spend</p>
        <p className={`hero-value ${isPositive ? "hero-value--good" : "hero-value--critical"}`}>
          {formatUSD(amountLeft)}
        </p>
        <p className="hero-subtitle">Remaining this Quincena</p>
        <p className={`hero-pace ${pace.isOverPace ? "hero-pace--warning" : ""}`}>
          {formatUSD(amountLeft)} left · {pace.daysRemaining} day{pace.daysRemaining === 1 ? "" : "s"}{" "}
          left ·{" "}
          {pace.isLastDay ? "Last day of this quincena" : `~${formatUSD(pace.perDay)}/day`}
        </p>
        <button
          type="button"
          className="hero-action-link"
          onClick={handleJustGotPaid}
          disabled={pending}
        >
          {pending ? "Closing quincena..." : "I just got paid →"}
        </button>
      </div>

      {closedSummary && (
        <CycleClosedCard summary={closedSummary} onDismiss={() => setClosedSummary(null)} />
      )}
    </>
  );
}
