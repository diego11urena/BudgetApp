"use client";

import { useState } from "react";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatUSD } from "@/lib/format";
import { QuickAddSheet, type EditingTransaction } from "./QuickAddSheet";

const TYPE_LABEL: Record<CycleTransactionSummary["type"], string> = {
  EXPENSE: "Expense",
  INCOME: "Extra income",
  SAVINGS: "Savings",
};

export function TransactionList({
  transactions,
  expenseCategoryNames,
  savingsCategoryNames,
  emptyMessage = "Nothing logged yet this quincena.",
}: {
  transactions: CycleTransactionSummary[];
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  emptyMessage?: string;
}) {
  const [editing, setEditing] = useState<EditingTransaction | null>(null);

  if (transactions.length === 0) {
    return <p className="field-hint">{emptyMessage}</p>;
  }

  return (
    <div>
      {transactions.map((tx) => (
        <button
          type="button"
          className="transaction-row"
          key={tx.id}
          onClick={() => setEditing({ id: tx.id, type: tx.type, name: tx.name, amount: tx.amount })}
        >
          <div className="transaction-meta">
            <span className="transaction-name">{tx.name}</span>
            <span className="transaction-sub">
              {TYPE_LABEL[tx.type]}
              {tx.categoryName && tx.categoryName !== tx.name ? ` · ${tx.categoryName}` : ""}
              {tx.cycleLabel ? ` · ${tx.cycleLabel}` : ""}
            </span>
          </div>
          <span
            className={`transaction-amount ${tx.type === "INCOME" ? "transaction-amount--income" : ""}`}
          >
            {tx.type === "INCOME" ? "+" : "-"}
            {formatUSD(tx.amount)}
          </span>
        </button>
      ))}

      {editing && (
        <QuickAddSheet
          initialType={editing.type}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          editingTransaction={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
