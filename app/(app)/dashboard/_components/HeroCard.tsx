"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { computeQuincenaPace } from "@/lib/quincena-pace";
import { justGotPaidAction, type CycleClosedSummary } from "../actions";
import { CycleClosedCard } from "./CycleClosedCard";
import { ConfirmJustGotPaidSheet } from "./ConfirmJustGotPaidSheet";

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
  const [confirming, setConfirming] = useState(false);
  const [closedSummary, setClosedSummary] = useState<CycleClosedSummary | null>(null);
  const isPositive = amountLeft >= 0;
  const pace = computeQuincenaPace({ periodStart, now: new Date(), amountLeft, totalExpenses });

  async function handleConfirmedJustGotPaid() {
    setConfirming(false);
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
          {formatCurrency(amountLeft)}
        </p>
        <p className="hero-subtitle">Remaining this Quincena</p>
        <p className={`hero-pace ${pace.isOverPace ? "hero-pace--warning" : ""}`}>
          {formatCurrency(amountLeft)} left · {pace.daysRemaining} day{pace.daysRemaining === 1 ? "" : "s"}{" "}
          left ·{" "}
          {pace.isLastDay ? "Last day of this quincena" : `~${formatCurrency(pace.perDay)}/day`}
        </p>
        <button
          type="button"
          className="hero-action-link"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          {pending ? "Closing quincena..." : "I just got paid →"}
        </button>
      </div>

      {confirming && (
        <ConfirmJustGotPaidSheet
          onConfirm={handleConfirmedJustGotPaid}
          onCancel={() => setConfirming(false)}
        />
      )}

      {closedSummary && (
        <CycleClosedCard summary={closedSummary} onDismiss={() => setClosedSummary(null)} />
      )}
    </>
  );
}
