"use client";

import { formatCurrency, formatShortDate } from "@/lib/format";
import { useT } from "@/app/_components/LocaleProvider";
import type { BiggestTransactionRow } from "@/lib/breakdown-v2";

/**
 * Chapter 05 — "The single purchases that stood out." Top 5 discretionary
 * transactions by amount (lib/breakdown-v2's computeBiggestTransactions
 * already excludes fixed/recurring-linked and goal transfers, and
 * excludes whichever day chapter 04's own default panel is showing, so
 * the two chapters never repeat the same purchase).
 */
export default function BiggestTransactionsChapter({ rows }: { rows: BiggestTransactionRow[] }) {
  const t = useT();

  if (rows.length === 0) {
    return <p className="breakdown-chapter-empty">{t.breakdown.noSpending}</p>;
  }

  return (
    <ol className="biggest-transaction-list">
      {rows.map((row, index) => (
        <li key={row.id} className="biggest-transaction-row">
          <span className="biggest-transaction-rank" aria-hidden="true">
            {index + 1}
          </span>
          <div className="biggest-transaction-content">
            <span className="biggest-transaction-name">{row.name}</span>
            {row.categoryName && <span className="biggest-transaction-meta">{row.categoryName}</span>}
          </div>
          <div className="biggest-transaction-trailing">
            <span className="biggest-transaction-amount">{formatCurrency(row.amount)}</span>
            <span className="biggest-transaction-date">{formatShortDate(row.occurredAt)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
