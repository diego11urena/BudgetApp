"use client";

import { formatCurrency } from "@/lib/format";
import { useT } from "@/app/_components/LocaleProvider";
import type { CategoryRow } from "../types";

/**
 * Chapter 04 — this period's categories as bars, each with a tick marking
 * its own trailing-period average, so "is this a lot for me?" is answerable
 * without leaving the row. Adapted from TopCategoriesChart's .bar-chart
 * pattern rather than inventing a second one.
 */
export default function ByCategoryChapter({ categories }: { categories: CategoryRow[] }) {
  const t = useT();

  if (categories.length === 0) {
    return <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>;
  }

  // Bars scale against the biggest of anything drawn -- including the
  // average ticks, so a tick above this period's spend stays on the bar
  // instead of overflowing it.
  const max = Math.max(...categories.map((c) => Math.max(c.amount, c.rollingAverage ?? 0)), 1);

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
            {cat.rollingAverage !== null && (
              <span
                className="breakdown-category-tick"
                style={{ left: `${(cat.rollingAverage / max) * 100}%` }}
                title={t.breakdown.categoryAverageTick(formatCurrency(cat.rollingAverage))}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
