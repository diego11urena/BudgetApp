"use client";

import { useState } from "react";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { QuickAddSheet, type EditingTransaction } from "./QuickAddSheet";

const TYPE_LABEL: Record<CycleTransactionSummary["type"], string> = {
  EXPENSE: "Expense",
  INCOME: "Extra income",
  SAVINGS: "Savings",
};

function TransactionRowContent({ tx }: { tx: CycleTransactionSummary }) {
  return (
    <>
      <div className="transaction-meta">
        <span className="transaction-name">{tx.name}</span>
        <span className="transaction-sub">
          {TYPE_LABEL[tx.type]}
          {tx.categoryName && tx.categoryName !== tx.name ? ` · ${tx.categoryName}` : ""}
          {tx.cycleLabel ? ` · ${tx.cycleLabel}` : ""}
          {tx.isEditable === false ? " · 🔒 closed" : ""}
        </span>
      </div>
      <span
        className={`transaction-amount ${tx.type === "INCOME" ? "transaction-amount--income" : ""}`}
      >
        {tx.type === "INCOME" ? "+" : "-"}
        {formatCurrency(tx.amount)}
      </span>
    </>
  );
}

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
  // Captured synchronously on click, before the sheet mounts — see
  // QuickAddSheet's returnFocusTo doc comment for why this can't just be
  // auto-detected inside the sheet itself.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  if (transactions.length === 0) {
    return <p className="field-hint">{emptyMessage}</p>;
  }

  return (
    <div>
      {transactions.map((tx) =>
        tx.isEditable === false ? (
          // A closed cycle's history is frozen — no edit sheet for this row.
          <div className="transaction-row transaction-row--readonly" key={tx.id}>
            <TransactionRowContent tx={tx} />
          </div>
        ) : (
          <button
            type="button"
            className="transaction-row"
            key={tx.id}
            onClick={(e) => {
              setTriggerElement(e.currentTarget);
              setEditing({ id: tx.id, type: tx.type, name: tx.name, amount: tx.amount });
            }}
          >
            <TransactionRowContent tx={tx} />
          </button>
        ),
      )}

      {editing && (
        <QuickAddSheet
          initialType={editing.type}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          editingTransaction={editing}
          returnFocusTo={triggerElement}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
