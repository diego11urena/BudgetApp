"use client";

import { useState } from "react";
import Link from "next/link";
import Heatmap from "@/app/(app)/_components/charts/Heatmap";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { useT } from "@/app/_components/LocaleProvider";
import type { DayTransaction, HeatmapDayData } from "../types";

/**
 * Chapter 04 — the heatmap, plus whatever the selected day actually held.
 *
 * The only chapter that owns state: Heatmap is a controlled component
 * (selection lives in the parent), and tapping a cell swaps the detail list
 * below it.
 */
export default function WhenYouSpendChapter({
  days,
  defaultSelected,
  transactionsByDay,
  state,
}: {
  days: HeatmapDayData[];
  defaultSelected: string | null;
  transactionsByDay: Record<string, DayTransaction[]>;
  state: "LIVE" | "CLOSED";
}) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(defaultSelected);

  const rows = selected ? (transactionsByDay[selected] ?? []) : [];
  const dayTotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const hasAnySpend = days.some((d) => d.total > 0);

  if (!hasAnySpend) {
    return <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>;
  }

  // Neither qualifier is "whichever day the user happens to have tapped" --
  // TODAY only applies in LIVE, LAST DAY only when the selected day is
  // actually the final day of the period (CLOSED's own default selection,
  // per pickDefaultSelectedDay, but a user can tap an earlier day too).
  const isToday = state === "LIVE" && selected === formatCycleLabel(new Date());
  const isLastDayOfPeriod = state === "CLOSED" && days.length > 0 && selected === days[days.length - 1].date;

  return (
    <>
      <Heatmap days={days} selectedDate={selected} onSelectDay={setSelected} />

      {selected && (
        <div className="breakdown-day-detail">
          <div className="breakdown-day-detail-head">
            {/* Parsed back through the same Panama anchor the label was
                built with -- "2026-08-10" read as a bare Date is UTC
                midnight, which is the 9th in Panama. */}
            <span className="breakdown-day-detail-header">
              {isToday
                ? t.breakdown.dayPanelHeaderToday(formatShortDate(new Date(`${selected}T05:00:00.000Z`)), formatCurrency(dayTotal))
                : isLastDayOfPeriod
                  ? t.breakdown.dayPanelHeaderLastDay(formatShortDate(new Date(`${selected}T05:00:00.000Z`)), formatCurrency(dayTotal))
                  : t.breakdown.dayPanelHeaderPlain(formatShortDate(new Date(`${selected}T05:00:00.000Z`)), formatCurrency(dayTotal))}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>
          ) : (
            <>
              <ul className="breakdown-day-list">
                {rows.map((row) => (
                  <li key={row.id} className="breakdown-day-row">
                    <span className="breakdown-day-row-name">
                      {row.name}
                      {row.isRecurring && <span className="breakdown-day-row-tag">{t.breakdown.recurringTag}</span>}
                    </span>
                    <span className="breakdown-day-row-meta">{row.categoryName ?? ""}</span>
                    <span className="breakdown-day-row-amount">{formatCurrency(row.amount)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/transactions" className="breakdown-day-view-all">
                {t.breakdown.viewTransactions}
              </Link>
            </>
          )}
        </div>
      )}
    </>
  );
}
