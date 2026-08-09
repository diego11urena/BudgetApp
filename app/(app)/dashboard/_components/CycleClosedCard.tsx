"use client";

import { useRef } from "react";
import { formatCurrency } from "@/lib/format";
import { iconForCategoryName } from "@/lib/category-icons";
import { useModalFocus } from "../../_components/useModalFocus";
import type { CycleClosedSummary } from "../actions";

export function CycleClosedCard({
  summary,
  onDismiss,
  returnFocusTo = null,
}: {
  summary: CycleClosedSummary;
  onDismiss: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const isOver = summary.budget.hasBudget && summary.budget.overBy > 0;
  const isPositiveRollover = summary.rolledOver >= 0;
  const cardRef = useRef<HTMLDivElement>(null);
  useModalFocus(cardRef, onDismiss, returnFocusTo);

  return (
    <div className="cycle-closed-overlay" role="dialog" aria-modal="true" aria-label="Quincena closed">
      <div ref={cardRef} tabIndex={-1} className="cycle-closed-card">
        <p className="cycle-closed-emoji">🎉</p>
        <h1 className="cycle-closed-title">Quincena closed</h1>

        <div className="summary-row">
          <div className="summary-item">
            <span className="summary-label">Spent</span>
            <span className="summary-value">{formatCurrency(summary.spent)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Saved</span>
            <span className="summary-value summary-value--good">{formatCurrency(summary.saved)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Rolled over</span>
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
              {iconForCategoryName(summary.topCategory.name)} Top category: {summary.topCategory.name}
            </span>
            <span>{formatCurrency(summary.topCategory.amount)}</span>
          </div>
        )}

        {summary.budget.hasBudget && (
          <div className={`banner ${isOver ? "banner--critical" : "banner--good"}`}>
            {isOver ? `Over budget by ${formatCurrency(summary.budget.overBy)}` : "On budget"}
          </div>
        )}

        <button type="button" className="button cycle-closed-cta" onClick={onDismiss}>
          Continue →
        </button>
      </div>
    </div>
  );
}
