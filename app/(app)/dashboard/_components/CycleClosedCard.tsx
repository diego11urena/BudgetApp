"use client";

import { useRef } from "react";
import { ArrowRight, PartyPopper } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { useModalFocus } from "../../_components/useModalFocus";
import type { CycleClosedSummary } from "../actions";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

export function CycleClosedCard({
  summary,
  onDismiss,
  returnFocusTo = null,
}: {
  summary: CycleClosedSummary;
  onDismiss: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useT().dashboard.cycleClosed;
  const vocab = useVocab();
  const isOver = summary.budget.hasBudget && summary.budget.overBy > 0;
  const isPositiveRollover = summary.rolledOver >= 0;
  const cardRef = useRef<HTMLDivElement>(null);
  useModalFocus(cardRef, onDismiss, returnFocusTo);

  return (
    <div className="cycle-closed-overlay" role="dialog" aria-modal="true" aria-label={t.aria(vocab)}>
      <div ref={cardRef} tabIndex={-1} className="cycle-closed-card">
        <p className="cycle-closed-emoji">
          <PartyPopper size={40} aria-hidden="true" />
        </p>
        <h1 className="cycle-closed-title">{t.title(vocab)}</h1>

        <div className="summary-row">
          <div className="summary-item">
            <span className="summary-label">{t.spent}</span>
            <span className="summary-value">{formatCurrency(summary.spent)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">{t.saved}</span>
            <span className="summary-value summary-value--good">{formatCurrency(summary.saved)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">{t.rolledOver}</span>
            <span
              className={`summary-value ${isPositiveRollover ? "summary-value--good" : ""}`}
            >
              {formatCurrency(summary.rolledOver)}
            </span>
          </div>
        </div>

        {summary.topCategory && (
          <div className="cycle-closed-top-category">
            <span>
              <CategoryIcon name={summary.topCategory.name} icon={summary.topCategory.icon} size={16} aria-hidden="true" />{" "}
              {t.topCategory(summary.topCategory.name)}
            </span>
            <span>{formatCurrency(summary.topCategory.amount)}</span>
          </div>
        )}

        {summary.budget.hasBudget && (
          <div
            className={`banner ${isOver ? "banner--critical" : "banner--good"}`}
            role={isOver ? "alert" : "status"}
          >
            {isOver ? t.overBudgetBy(formatCurrency(summary.budget.overBy)) : t.onBudget}
          </div>
        )}

        {/* Moved here from the dashboard's own Insights card -- a streak is
            being won right at this exact moment (the cycle that just
            closed is the newest one counted), not something worth
            repeating all quincena long. */}
        {summary.streak >= 2 && (
          <div className="banner banner--good" role="status">
            {t.streak(vocab, summary.streak)}
          </div>
        )}

        <button type="button" className="button cycle-closed-cta" onClick={onDismiss}>
          {t.continue} <ArrowRight size={16} aria-hidden="true" className="inline-arrow" />
        </button>
      </div>
    </div>
  );
}
