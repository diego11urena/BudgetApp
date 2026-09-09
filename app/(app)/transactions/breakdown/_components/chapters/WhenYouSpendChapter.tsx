"use client";

import { useState } from "react";
import Heatmap from "@/app/(app)/_components/charts/Heatmap";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { useT } from "@/app/_components/LocaleProvider";
import type { DayTransaction, HeatmapDayData } from "../types";

/**
 * Chapter 01 — the heatmap, plus whatever the selected day actually held.
 *
 * The only chapter that owns state: Heatmap is a controlled component
 * (selection lives in the parent), and tapping a cell swaps the detail list
 * below it.
 */
export default function WhenYouSpendChapter({
  days,
  defaultSelected,
  transactionsByDay,
}: {
  days: HeatmapDayData[];
  defaultSelected: string | null;
  transactionsByDay: Record<string, DayTransaction[]>;
}) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(defaultSelected);

  const rows = selected ? (transactionsByDay[selected] ?? []) : [];
  const dayTotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const hasAnySpend = days.some((d) => d.total > 0);

  if (!hasAnySpend) {
    return <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>;
  }

  return (
    <>
      <Heatmap days={days} selectedDate={selected} onSelectDay={setSelected} />

      {selected && (
        <div className="breakdown-day-detail">
          <div className="breakdown-day-detail-head">
            {/* Parsed back through the same Panama anchor the label was
                built with -- "2026-08-10" read as a bare Date is UTC
                midnight, which is the 9th in Panama. */}
            <span>{formatFriendlyDate(new Date(`${selected}T05:00:00.000Z`))}</span>
            <span className="breakdown-day-detail-total">{formatCurrency(dayTotal)}</span>
          </div>

          {rows.length === 0 ? (
            <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>
          ) : (
            <ul className="breakdown-day-list">
              {rows.map((row) => (
                <li key={row.id} className="breakdown-day-row">
                  <span className="breakdown-day-row-name">
                    {row.name}
                    {row.isBill && <span className="breakdown-day-row-tag">{t.plan.bills.title}</span>}
                  </span>
                  <span className="breakdown-day-row-meta">{row.categoryName ?? ""}</span>
                  <span className="breakdown-day-row-amount">{formatCurrency(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
