"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import { useT, useLocale } from "@/app/_components/LocaleProvider";
import type { CashFlowBreakdown } from "@/lib/breakdown-v2";

/**
 * Chapter 01 — "Where the paycheck went." A single segmented bar, Fixed →
 * Everything else → Saved, widths as a share of income; Leftover is
 * deliberately the unfilled remainder of the track, not its own segment
 * (income = fixed + everythingElse + saved + leftover always holds, see
 * lib/breakdown-v2's computeCashFlowBreakdown — drawing Leftover as a
 * fourth segment would just be redrawing the same unfilled space twice).
 */
export default function CashFlowChapter({ cashFlow, incomeLine }: { cashFlow: CashFlowBreakdown; incomeLine: string }) {
  const t = useT();
  const locale = useLocale();
  const { fixed, everythingElse, saved, savedGoals, leftover, income } = cashFlow;
  const pct = (n: number) => (income > 0 ? (n / income) * 100 : 0);

  return (
    <>
      <p className="breakdown-chapter-lede">{incomeLine}</p>

      <div className="cash-flow-bar" role="img" aria-label={incomeLine}>
        <div className="cash-flow-bar-segment cash-flow-bar-segment--fixed" style={{ width: `${pct(fixed)}%` }} />
        <div className="cash-flow-bar-segment cash-flow-bar-segment--discretionary" style={{ width: `${pct(everythingElse)}%` }} />
        <div className="cash-flow-bar-segment cash-flow-bar-segment--saved" style={{ width: `${pct(saved)}%` }} />
        {/* Leftover: the unfilled remainder of the track — no segment rendered. */}
      </div>

      <ul className="cash-flow-legend">
        <li className="cash-flow-legend-row">
          <span className="cash-flow-legend-swatch cash-flow-legend-swatch--fixed" aria-hidden="true" />
          <span>{t.breakdown.fixedLabel}</span>
          <span className="cash-flow-legend-amount">{formatCurrency(fixed)}</span>
        </li>
        <li className="cash-flow-legend-row">
          <span className="cash-flow-legend-swatch cash-flow-legend-swatch--discretionary" aria-hidden="true" />
          <span>{t.breakdown.discretionaryLabel}</span>
          <span className="cash-flow-legend-amount">{formatCurrency(everythingElse)}</span>
        </li>
        <li>
          <Link href="/goals" className="cash-flow-legend-row cash-flow-legend-row--tappable">
            <span className="cash-flow-legend-swatch cash-flow-legend-swatch--saved" aria-hidden="true" />
            <span>{t.breakdown.savedLabel}</span>
            <span className="cash-flow-legend-amount">{formatCurrency(saved)}</span>
          </Link>
          {savedGoals.length > 0 && (
            <span className="cash-flow-legend-sublabel">
              {t.breakdown.savedGoalsList(new Intl.ListFormat(locale === "es" ? "es" : "en", { style: "long", type: "conjunction" }).format(savedGoals))}
            </span>
          )}
        </li>
        <li className="cash-flow-legend-row">
          <span className="cash-flow-legend-swatch cash-flow-legend-swatch--leftover" aria-hidden="true" />
          <span>{t.breakdown.leftoverLabel}</span>
          <span className="cash-flow-legend-amount">{formatCurrency(leftover)}</span>
        </li>
      </ul>
    </>
  );
}
