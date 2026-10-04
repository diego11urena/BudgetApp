"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { categoryColorVar } from "@/lib/category-colors";
import type { CategoryTransactionRow } from "@/lib/breakdown-v2";
import { activityHref } from "@/app/(app)/transactions/breakdown/_components/types";
import { useT, useLocale } from "@/app/_components/LocaleProvider";

/**
 * The one donut in the product. The design system is explicit that no
 * other pie/donut/area chart survives anywhere in Summary or Breakdown,
 * so this is deliberately not a general-purpose chart component: it
 * renders By category and nothing else.
 *
 * Geometry is the spec's literal numbers -- 220px box, outer r 104,
 * inner r 62, 0.012 rad trimmed off each slice edge to make the gaps --
 * so it matches screens/20 and screens/32 at 2x without eyeballing.
 *
 * Tap-only by design (DESIGN.md S5: "No hover states"). A slice and its
 * legend row are two affordances for the same selection; the legend rows
 * are the tab stops, and the slices are redundant pointer targets, which
 * is why the slices carry aria-hidden and the legend carries aria-pressed
 * rather than both announcing themselves to a screen reader.
 */

export interface CategoryDonutSlice {
  categoryId: string;
  categoryName: string;
  amount: number;
  /** Mean of the last 6 closed periods; null when there's no history yet. */
  usualAmount: number | null;
}

const SIZE = 220;
const CENTER = SIZE / 2;
const R_OUTER = 104;
const R_INNER = 62;
/** Trimmed from BOTH edges of every slice, hence the visible gaps. */
const EDGE_TRIM = 0.012;
/** How far the selected slice slides out along its own mid-angle. */
const SELECTED_OFFSET = 6;
/** Non-selected slices while something is selected. */
const DIMMED_OPACITY = 0.28;

function polar(radius: number, angle: number): [number, number] {
  // Rounded to 3 decimals: Node and the browser can disagree in the last
  // digit of Math.cos/Math.sin, which made the server-rendered path differ
  // from the client's and tripped a hydration mismatch on every load.
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return [round(CENTER + radius * Math.cos(angle)), round(CENTER + radius * Math.sin(angle))];
}

/**
 * An annular sector (a ring segment) from `start` to `end`, both in
 * radians clockwise from 12 o'clock.
 */
function annularSector(start: number, end: number): string {
  const largeArc = end - start > Math.PI ? 1 : 0;
  const [ox1, oy1] = polar(R_OUTER, start);
  const [ox2, oy2] = polar(R_OUTER, end);
  const [ix2, iy2] = polar(R_INNER, end);
  const [ix1, iy1] = polar(R_INNER, start);
  return [
    `M ${ox1} ${oy1}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    "Z",
  ].join(" ");
}

export default function CategoryDonut({
  slices,
  total,
  state,
  topTransactionsByCategory = {},
  transactionCountByCategory = {},
  activityCycleId = null,
}: {
  slices: CategoryDonutSlice[];
  total: number;
  state: "LIVE" | "CLOSED";
  /**
   * Each category's own biggest transactions, keyed by category id (see
   * computeTopTransactionsByCategory). Selecting a slice previews that
   * category's rows underneath, which is the point of selecting one.
   */
  topTransactionsByCategory?: Record<string, CategoryTransactionRow[]>;
  /** Each category's full transaction count this period -- the preview header's "{n} transactions". */
  transactionCountByCategory?: Record<string, number>;
  /** Scopes the "View transactions" link to a closed cycle; null leaves Activity on the current one. */
  activityCycleId?: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const titleId = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = slices.find((s) => s.categoryId === selectedId) ?? null;
  const selectedRows = selected ? (topTransactionsByCategory[selected.categoryId] ?? []) : [];
  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id));

  const shareOf = (amount: number) => (total > 0 ? amount / total : 0);
  const formatShare = (amount: number) => `${Math.round(shareOf(amount) * 100)}%`;

  /**
   * Walks the slices into angles once. Starts at -PI/2 (12 o'clock) and
   * runs clockwise, which in SVG's y-down coordinate space is simply
   * increasing angle -- no mirroring needed.
   *
   * Written as a fold rather than a map over a running `let`, so nothing
   * is reassigned during render (the React Compiler rejects that, and it
   * is genuinely a hazard once a component can re-run mid-render).
   */
  const arcs = slices.reduce<Array<{ slice: CategoryDonutSlice; start: number; end: number; sweep: number }>>(
    (acc, slice) => {
      const sweep = shareOf(slice.amount) * Math.PI * 2;
      const start = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1].end;
      acc.push({ slice, start, end: start + sweep, sweep });
      return acc;
    },
    [],
  );

  /** A lone category can't have gaps -- it's a closed ring, not a sector. */
  const isSingleFullRing = arcs.length === 1;

  function centreCompare(): string | null {
    if (!selected) return null;
    const share = formatShare(selected.amount);
    if (selected.usualAmount === null) return t.breakdown.donutShareNew(share);
    const delta = selected.amount - selected.usualAmount;
    // Under a cent either way reads as "same" rather than a $0.00
    // over/under, which would be true but useless.
    if (Math.abs(delta) < 0.01) return t.breakdown.donutShareSameAsUsual(share);
    return delta > 0
      ? t.breakdown.donutShareOverUsual(share, formatCurrency(delta))
      : t.breakdown.donutShareUnderUsual(share, formatCurrency(Math.abs(delta)));
  }

  return (
    <div className="category-donut">
      <div className="category-donut-figure">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="category-donut-svg"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{t.breakdown.chapter3Title}</title>
          {arcs.map(({ slice, start, end, sweep }) => {
            const isSelected = slice.categoryId === selectedId;
            const mid = start + sweep / 2;
            const offset = isSelected
              ? `translate(${Math.cos(mid) * SELECTED_OFFSET} ${Math.sin(mid) * SELECTED_OFFSET})`
              : undefined;

            if (isSingleFullRing) {
              return (
                <circle
                  key={slice.categoryId}
                  className="category-donut-slice"
                  cx={CENTER}
                  cy={CENTER}
                  r={(R_OUTER + R_INNER) / 2}
                  fill="none"
                  stroke={categoryColorVar(slice.categoryName)}
                  strokeWidth={R_OUTER - R_INNER}
                  onClick={() => toggle(slice.categoryId)}
                  aria-hidden="true"
                />
              );
            }

            // Trim both edges, but never past the point where the slice
            // would invert -- a sliver category still gets a hairline.
            const trim = Math.min(EDGE_TRIM, sweep / 3);
            return (
              <path
                key={slice.categoryId}
                className="category-donut-slice"
                d={annularSector(start + trim, end - trim)}
                fill={categoryColorVar(slice.categoryName)}
                opacity={selectedId && !isSelected ? DIMMED_OPACITY : 1}
                transform={offset}
                onClick={() => toggle(slice.categoryId)}
                aria-hidden="true"
              />
            );
          })}
        </svg>

        {/* pointer-events:none in CSS so the centre never eats a tap
            meant for the ring behind it. */}
        <div className="category-donut-centre">
          {selected ? (
            <>
              <p className="category-donut-centre-label">{selected.categoryName}</p>
              <p className="category-donut-centre-value">{formatCurrency(selected.amount)}</p>
              <p className="category-donut-centre-sub">{centreCompare()}</p>
            </>
          ) : (
            <>
              <p className="category-donut-centre-label">{t.breakdown.donutCenterLabel}</p>
              <p className="category-donut-centre-value">{formatCurrency(total)}</p>
              <p className="category-donut-centre-sub">
                {t.breakdown.donutCategoryCount(slices.length, state)}
              </p>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="category-preview">
          <div className="category-preview-head">
            <span
              className="category-donut-legend-swatch"
              style={{ background: categoryColorVar(selected.categoryName) }}
              aria-hidden="true"
            />
            <span className="category-preview-heading">{t.breakdown.categoryPreviewHeading(selected.categoryName)}</span>
            <span className="category-preview-count">
              {t.transactions.count(transactionCountByCategory[selected.categoryId] ?? selectedRows.length)}
            </span>
          </div>
          {/* A category with nothing in it says so, rather than
              rendering an empty list or (worse) somebody else's rows.
              Defensive in practice -- the donut only draws categories
              that have spend -- but the alternative to a defensive
              branch here is a silently blank panel. */}
          {selectedRows.length === 0 && (
            <p className="category-preview-empty">{t.breakdown.categoryNoTransactions}</p>
          )}
          <ul className="category-preview-list">
            {selectedRows.map((row) => (
              <li key={row.id} className="category-preview-row">
                <span className="category-preview-text">
                  <span className="category-preview-name">{row.name}</span>
                  <span className="category-preview-meta">{formatShortDate(row.occurredAt, locale)}</span>
                </span>
                <span className="category-preview-amount">{formatCurrency(row.amount)}</span>
              </li>
            ))}
          </ul>
          <Link href={activityHref(activityCycleId, selected.categoryId)} className="category-preview-view-all">
            {t.breakdown.viewTransactions}
          </Link>
        </div>
      )}
      <ul className="category-donut-legend">
        {slices.map((slice) => {
          const isSelected = slice.categoryId === selectedId;
          return (
            <li key={slice.categoryId}>
              <button
                type="button"
                className={`category-donut-legend-row${isSelected ? " is-selected" : ""}`}
                aria-pressed={isSelected}
                onClick={() => toggle(slice.categoryId)}
                style={selectedId && !isSelected ? { opacity: 0.55 } : undefined}
              >
                <span
                  className="category-donut-legend-swatch"
                  style={{ background: categoryColorVar(slice.categoryName) }}
                  aria-hidden="true"
                />
                <span className="category-donut-legend-text">
                  <span className="category-donut-legend-name">{slice.categoryName}</span>
                  <span className="category-donut-legend-usual">
                    {slice.usualAmount !== null
                      ? t.breakdown.categoryUsual(formatCurrency(slice.usualAmount))
                      : t.breakdown.categoryNew}
                  </span>
                </span>
                <span className="category-donut-legend-figures">
                  <span className="category-donut-legend-amount">{formatCurrency(slice.amount)}</span>
                  <span className="category-donut-legend-share">{formatShare(slice.amount)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Only while a slice is selected. The resting state of this chapter
          stays exactly what it was -- donut plus full legend -- and this
          panel is an addition under it, not a replacement for either. */}
    </div>
  );
}
