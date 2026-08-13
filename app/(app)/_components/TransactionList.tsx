"use client";

import { Fragment, useState } from "react";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { groupTransactionsByDate } from "@/lib/transaction-grouping";
import { QuickAddSheet, type EditingTransaction } from "./QuickAddSheet";

const TYPE_LABEL: Record<CycleTransactionSummary["type"], string> = {
  EXPENSE: "Expense",
  INCOME: "Extra income",
  SAVINGS: "Savings",
};

const PAYMENT_METHOD_LABEL: Record<NonNullable<CycleTransactionSummary["paymentMethod"]>, string> = {
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  YAPPY: "Yappy",
};

function TransactionRowContent({
  tx,
  showCycleLabel,
}: {
  tx: CycleTransactionSummary;
  showCycleLabel: boolean;
}) {
  return (
    <>
      <div className="transaction-meta">
        <span className="transaction-name">{tx.name}</span>
        <span className="transaction-sub">
          {TYPE_LABEL[tx.type]}
          {tx.categoryName && tx.categoryName !== tx.name ? ` · ${tx.categoryName}` : ""}
          {!tx.categoryName && tx.type !== "INCOME" ? " · Uncategorized" : ""}
          {tx.paymentMethod ? ` · ${PAYMENT_METHOD_LABEL[tx.paymentMethod]}` : ""}
          {showCycleLabel && tx.cycleLabel ? ` · ${tx.cycleLabel}` : ""}
          {tx.importSource === "GMAIL" ? " · 📧 Gmail" : ""}
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

function TransactionRow({
  tx,
  showCycleLabel,
  onEdit,
}: {
  tx: CycleTransactionSummary;
  showCycleLabel: boolean;
  onEdit: (tx: CycleTransactionSummary, trigger: HTMLElement) => void;
}) {
  if (tx.isEditable === false) {
    // A closed cycle's history is frozen — no edit sheet for this row.
    return (
      <div className="transaction-row transaction-row--readonly">
        <TransactionRowContent tx={tx} showCycleLabel={showCycleLabel} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="transaction-row"
      onClick={(e) => onEdit(tx, e.currentTarget)}
    >
      <TransactionRowContent tx={tx} showCycleLabel={showCycleLabel} />
    </button>
  );
}

export function TransactionList({
  transactions,
  expenseCategoryNames,
  savingsCategoryNames,
  cycleStartDate,
  emptyMessage = "Nothing logged yet this quincena.",
  groupByDate = false,
}: {
  transactions: CycleTransactionSummary[];
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  /** "YYYY-MM-DD" — the current open cycle's periodStart, passed through to QuickAddSheet's Date field. Every row this list lets you edit belongs to that cycle (isEditable === false rows, from other cycles, never open the sheet at all). */
  cycleStartDate: string;
  emptyMessage?: string;
  /**
   * Renders a "Today"/"Yesterday"/date section header above each
   * consecutive same-day run instead of repeating a date on every row.
   * Only makes sense when the list is already sorted by date — the caller
   * is responsible for not passing this for an amount-sorted list, where
   * same-day rows aren't contiguous.
   */
  groupByDate?: boolean;
}) {
  const [editing, setEditing] = useState<EditingTransaction | null>(null);
  // Captured synchronously on click, before the sheet mounts — see
  // QuickAddSheet's returnFocusTo doc comment for why this can't just be
  // auto-detected inside the sheet itself.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  if (transactions.length === 0) {
    return <p className="field-hint">{emptyMessage}</p>;
  }

  function handleEdit(tx: CycleTransactionSummary, trigger: HTMLElement) {
    setTriggerElement(trigger);
    setEditing({
      id: tx.id,
      type: tx.type,
      name: tx.name,
      categoryName: tx.categoryName,
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      occurredAt: formatCycleLabel(tx.occurredAt),
    });
  }

  // Grouping also drops the per-row cycle label — the group header already
  // conveys the transaction's actual date, so repeating a cycle's start
  // date per row (which isn't even the same thing) is just noise.
  const showCycleLabel = !groupByDate;

  return (
    <div>
      {groupByDate ? (
        groupTransactionsByDate(transactions).map((group) => (
          <Fragment key={group.label + group.items[0].id}>
            <h3 className="transaction-date-group">{group.label}</h3>
            {group.items.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showCycleLabel={showCycleLabel} onEdit={handleEdit} />
            ))}
          </Fragment>
        ))
      ) : (
        transactions.map((tx) => (
          <TransactionRow key={tx.id} tx={tx} showCycleLabel={showCycleLabel} onEdit={handleEdit} />
        ))
      )}

      {editing && (
        <QuickAddSheet
          initialType={editing.type}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          cycleStartDate={cycleStartDate}
          editingTransaction={editing}
          returnFocusTo={triggerElement}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
