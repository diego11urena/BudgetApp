"use client";

import { formatCurrency } from "@/lib/format";
import { useT } from "@/app/_components/LocaleProvider";
import type { CategoryRow } from "../types";

/**
 * Chapter 03 — this period's categories as bars, sorted biggest-to-
 * smallest (categories arrives pre-sorted from page.tsx's own
 * categoryTotals), each with a "Usual: $X" line (mean of the last 6
 * closed periods) instead of the tick-mark this chapter used to draw on
 * the bar itself -- the design spec calls for text here, not a second
 * mark competing with the bar's own length for attention. Bars are
 * neutral (--chart-neutral-bar): unlike chapter 01's cash-flow segments,
 * these deliberately don't encode fixed vs. discretionary, just relative
 * size. Adapted from TopCategoriesChart's .bar-chart pattern rather than
 * inventing a second one.
 */
export default function ByCategoryChapter({ categories }: { categories: CategoryRow[] }) {
  const t = useT();

  if (categories.length === 0) {
    return <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>;
  }

  const max = Math.max(...categories.map((c) => c.amount), 1);

  return (
    <ul className="breakdown-category-list">
      {categories.map((cat) => (
        <li key={cat.categoryId} className="breakdown-category-row">
          <span className="breakdown-category-label">
            {cat.categoryIcon && <span aria-hidden="true">{cat.categoryIcon}</span>} {cat.categoryName}
          </span>
          <span className="breakdown-category-amount">{formatCurrency(cat.amount)}</span>
          <div className="breakdown-category-track">
            <div className="breakdown-category-fill" style={{ width: `${(cat.amount / max) * 100}%` }} />
          </div>
          <span className="breakdown-category-usual">
            {cat.usualAmount !== null ? t.breakdown.categoryUsual(formatCurrency(cat.usualAmount)) : t.breakdown.categoryNew}
          </span>
        </li>
      ))}
    </ul>
  );
}
