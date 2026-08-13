"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BreakdownSlice, PaycheckBreakdown } from "@/lib/paycheck-breakdown";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { PieChart } from "./PieChart";

export function BreakdownScreen({
  breakdown,
  recentTransactionsBySlice,
}: {
  breakdown: PaycheckBreakdown;
  recentTransactionsBySlice: Record<string, CycleTransactionSummary[]>;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sliceByKey = useMemo(() => {
    const map = new Map<string, BreakdownSlice>();
    // legendSlices first so an expense/savings/remaining slice's canonical
    // (ungrouped) data wins; chartSlices adds "other", which only exists there.
    for (const slice of breakdown.legendSlices) map.set(slice.key, slice);
    for (const slice of breakdown.chartSlices) if (!map.has(slice.key)) map.set(slice.key, slice);
    return map;
  }, [breakdown]);

  const selectedSlice = selectedKey ? (sliceByKey.get(selectedKey) ?? null) : null;

  function handleSelect(key: string) {
    setSelectedKey((current) => (current === key ? null : key));
  }

  return (
    <>
      <PieChart slices={breakdown.chartSlices} selectedKey={selectedKey} onSelect={handleSelect} />

      <ul className="breakdown-legend">
        {breakdown.legendSlices.map((slice) => (
          <li key={slice.key}>
            <button
              type="button"
              className={`breakdown-legend-row ${selectedKey === slice.key ? "is-selected" : ""}`}
              onClick={() => handleSelect(slice.key)}
              aria-pressed={selectedKey === slice.key}
            >
              <span className="breakdown-legend-swatch" style={{ background: `var(${slice.colorVar})` }} />
              <span className="breakdown-legend-label">{slice.label}</span>
              <span className="breakdown-legend-amount">{formatCurrency(slice.amount)}</span>
              <span className="breakdown-legend-percent">{Math.round(slice.percentage)}%</span>
            </button>
          </li>
        ))}
      </ul>

      {selectedSlice && (
        <SliceDetailPanel
          slice={selectedSlice}
          recentTransactions={recentTransactionsBySlice[selectedSlice.key] ?? []}
          onSelectMember={handleSelect}
        />
      )}
    </>
  );
}

function SliceDetailPanel({
  slice,
  recentTransactions,
  onSelectMember,
}: {
  slice: BreakdownSlice;
  recentTransactions: CycleTransactionSummary[];
  onSelectMember: (key: string) => void;
}) {
  return (
    <div className="breakdown-detail-panel">
      <div className="breakdown-detail-header">
        <span className="breakdown-legend-swatch" style={{ background: `var(${slice.colorVar})` }} />
        <span className="breakdown-detail-title">{slice.label}</span>
        <span className="breakdown-detail-amount">
          {formatCurrency(slice.amount)} · {Math.round(slice.percentage)}%
        </span>
      </div>

      {slice.kind === "remaining" && (
        <p className="field-hint">Not yet spent or saved this quincena.</p>
      )}

      {slice.kind === "other" && slice.members && (
        <div className="breakdown-detail-members">
          <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
            Made up of {slice.members.length} smaller categor{slice.members.length === 1 ? "y" : "ies"}:
          </p>
          {slice.members.map((member) => (
            <button
              type="button"
              key={member.key}
              className="breakdown-detail-member-row"
              onClick={() => onSelectMember(member.key)}
            >
              <span>{member.label}</span>
              <span>
                {formatCurrency(member.amount)} · {Math.round(member.percentage)}%
              </span>
            </button>
          ))}
        </div>
      )}

      {(slice.kind === "expense" || slice.kind === "savings") && (
        <>
          {recentTransactions.length > 0 ? (
            <div className="breakdown-detail-transactions">
              {recentTransactions.map((tx) => (
                <div className="breakdown-detail-tx-row" key={tx.id}>
                  <span>{tx.name}</span>
                  <span>{formatCurrency(tx.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="field-hint">No transactions logged yet.</p>
          )}
          <Link
            href={
              slice.kind === "savings"
                ? "/transactions?type=SAVINGS"
                : `/transactions?q=${encodeURIComponent(slice.label)}`
            }
            className="line-item line-item--link"
          >
            <span>See all →</span>
          </Link>
        </>
      )}
    </div>
  );
}
