"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  computeBreakdown,
  groupRecentTransactionsBySlice,
  type BreakdownGroupBy,
  type BreakdownScope,
  type BreakdownSlice,
  type GroupTotal,
} from "@/lib/paycheck-breakdown";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { PieChart } from "./PieChart";

export interface BreakdownCycleData {
  baseIncome: number;
  extraIncome: number;
  totalExpenses: number;
  totalSavings: number;
  categoryTotals: GroupTotal[];
  paymentMethodTotals: GroupTotal[];
  transactions: CycleTransactionSummary[];
}

type Period = "current" | "last";

const SCOPE_OPTIONS: { value: BreakdownScope; label: string }[] = [
  { value: "full", label: "Full paycheck" },
  { value: "spending", label: "Spending only" },
];

const GROUP_BY_OPTIONS: { value: BreakdownGroupBy; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "paymentMethod", label: "Payment method" },
];

export function BreakdownScreen({
  currentCycle,
  lastCycle,
}: {
  currentCycle: BreakdownCycleData;
  lastCycle: BreakdownCycleData | null;
}) {
  const [scope, setScope] = useState<BreakdownScope>("full");
  const [period, setPeriod] = useState<Period>("current");
  const [groupBy, setGroupBy] = useState<BreakdownGroupBy>("category");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const activeCycle = period === "last" ? lastCycle : currentCycle;

  const groupTotals = useMemo(() => {
    if (!activeCycle) return [];
    return groupBy === "category" ? activeCycle.categoryTotals : activeCycle.paymentMethodTotals;
  }, [activeCycle, groupBy]);

  const breakdown = useMemo(() => {
    if (!activeCycle) return { pieTotal: 0, legendSlices: [], chartSlices: [] };
    return computeBreakdown({ ...activeCycle, groupTotals }, { scope, groupBy });
  }, [activeCycle, groupTotals, scope, groupBy]);

  const recentTransactionsBySlice = useMemo(() => {
    if (!activeCycle) return {};
    return groupRecentTransactionsBySlice(activeCycle.transactions, groupBy, groupTotals);
  }, [activeCycle, groupBy, groupTotals]);

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

  function handlePeriodChange(next: Period) {
    setPeriod(next);
    setSelectedKey(null);
  }

  function handleScopeChange(next: BreakdownScope) {
    setScope(next);
    setSelectedKey(null);
  }

  function handleGroupByChange(next: BreakdownGroupBy) {
    setGroupBy(next);
    setSelectedKey(null);
  }

  return (
    <>
      <div className="breakdown-toggles">
        <div className="type-toggle">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`type-toggle-btn ${scope === opt.value ? "is-active" : ""}`}
              onClick={() => handleScopeChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="type-toggle">
          <button
            type="button"
            className={`type-toggle-btn ${period === "current" ? "is-active" : ""}`}
            onClick={() => handlePeriodChange("current")}
          >
            This quincena
          </button>
          <button
            type="button"
            className={`type-toggle-btn ${period === "last" ? "is-active" : ""}`}
            onClick={() => handlePeriodChange("last")}
            disabled={!lastCycle}
          >
            Last quincena
          </button>
        </div>
        <div className="type-toggle">
          {GROUP_BY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`type-toggle-btn ${groupBy === opt.value ? "is-active" : ""}`}
              onClick={() => handleGroupByChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!activeCycle && (
        <p className="field-hint">No previous quincena yet — close this one first.</p>
      )}

      {activeCycle && breakdown.pieTotal <= 0 && (
        <p className="field-hint">Nothing to show for this combination yet.</p>
      )}

      {activeCycle && breakdown.pieTotal > 0 && (
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
                  <span
                    className="breakdown-legend-swatch"
                    style={{ background: `var(${slice.colorVar})` }}
                  />
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
              groupBy={groupBy}
              recentTransactions={recentTransactionsBySlice[selectedSlice.key] ?? []}
              onSelectMember={handleSelect}
            />
          )}
        </>
      )}
    </>
  );
}

function SliceDetailPanel({
  slice,
  groupBy,
  recentTransactions,
  onSelectMember,
}: {
  slice: BreakdownSlice;
  groupBy: BreakdownGroupBy;
  recentTransactions: CycleTransactionSummary[];
  onSelectMember: (key: string) => void;
}) {
  // Neither bucket maps to a real Transactions filter — "Unspecified"
  // isn't a pickable payment method, and a q= search for the literal text
  // "Uncategorized" wouldn't match transactions that have no category name
  // at all. The recent-transactions preview above still shows what's in it.
  const hasNoRealFilter =
    (groupBy === "paymentMethod" && slice.key === "UNSPECIFIED") ||
    (groupBy === "category" && slice.key === "UNCATEGORIZED");
  const seeAllHref =
    slice.kind === "savings"
      ? "/transactions?type=SAVINGS"
      : groupBy === "paymentMethod"
        ? `/transactions?paymentMethod=${encodeURIComponent(slice.key)}`
        : `/transactions?q=${encodeURIComponent(slice.label)}`;

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
            Made up of {slice.members.length} smaller group{slice.members.length === 1 ? "" : "s"}:
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
          {!hasNoRealFilter && (
            <Link href={seeAllHref} className="line-item line-item--link">
              <span>See all →</span>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
