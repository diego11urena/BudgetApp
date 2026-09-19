"use client";

import TrendAreaChart from "@/app/(app)/_components/charts/TrendAreaChart";
import { formatCurrency } from "@/lib/format";
import { useT, useVocab } from "@/app/_components/LocaleProvider";
import type { TrendPoint } from "@/lib/breakdown-v2";

/**
 * Chapter 02 — fixed vs discretionary, stacked, across the trailing
 * periods. Needs at least two points to be a trend rather than a dot.
 */
export default function TrendChapter({
  series,
  state,
}: {
  series: TrendPoint[];
  state: "LIVE" | "CLOSED";
}) {
  const t = useT();
  const vocab = useVocab();

  if (series.length < 2) {
    return <p className="breakdown-chapter-empty">{t.breakdown.notEnoughHistory(vocab)}</p>;
  }

  const latest = series[series.length - 1];

  return (
    <>
      <TrendAreaChart series={series} state={state} />
      <div className="breakdown-legend">
        <span className="breakdown-legend-item">
          <span className="breakdown-legend-swatch" style={{ background: "var(--chart-fixed)" }} />
          {t.breakdown.fixedLabel} · {formatCurrency(latest.fixed)}
        </span>
        <span className="breakdown-legend-item">
          <span className="breakdown-legend-swatch" style={{ background: "var(--chart-discretionary)" }} />
          {t.breakdown.discretionaryLabel} · {formatCurrency(latest.discretionary)}
        </span>
      </div>
    </>
  );
}
