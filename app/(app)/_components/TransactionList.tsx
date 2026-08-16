"use client";

import { Fragment, useState } from "react";
import { Lock } from "lucide-react";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { groupTransactionsByDate } from "@/lib/transaction-grouping";
import { QuickAddSheet, type EditingTransaction } from "./QuickAddSheet";

const PAYMENT_METHOD_LABEL: Record<NonNullable<CycleTransactionSummary["paymentMethod"]>, string> = {
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  YAPPY: "Yappy",
  ACH: "ACH",
};

const AMOUNT_CLASS: Record<CycleTransactionSummary["type"], string> = {
  EXPENSE: "",
  // The sign+color alone already distinguish Expense (white/red, minus)
  // from Income (green, plus) — no need to spell out the type in words.
  // Savings still needs its own look: it's also a minus (money leaving
  // spendable balance), so without a distinct color it would be visually
  // identical to an Expense row despite being fundamentally different
  // (money moved, not spent).
  INCOME: "transaction-amount--income",
  SAVINGS: "transaction-amount--savings",
};

function TransactionRowContent({
  tx,
  showCycleLabel,
}: {
  tx: CycleTransactionSummary;
  showCycleLabel: boolean;
}) {
  // "Category · Payment method" — either half is dropped cleanly (no
  // trailing separator, no placeholder) when missing. Gmail/source stays a
  // model field (see cycle-financials.ts), just not surfaced on the row
  // itself anymore — provenance metadata belongs in the detail sheet or as
  // a Transactions filter, not on every line. Every type has a category
  // concept now, so this no longer special-cases INCOME — a sent and a
  // received Yappy render identically apart from sign and color. The
  // closed-cycle marker is rendered as its own trailing icon+text (not
  // folded into this string) since it needs a real <Lock> icon, not text.
  const subline = [
    tx.categoryName && tx.categoryName !== tx.name
      ? tx.categoryName
      : !tx.categoryName
        ? "Uncategorized"
        : null,
    tx.paymentMethod ? PAYMENT_METHOD_LABEL[tx.paymentMethod] : null,
    showCycleLabel && tx.cycleLabel ? tx.cycleLabel : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const isClosed = tx.isEditable === false;

  return (
    <>
      <div className="transaction-meta">
        <span className="transaction-name">{tx.name}</span>
        {(subline || isClosed) && (
          <span className="transaction-sub">
            {subline}
            {isClosed && (
              <>
                {subline && " · "}
                <Lock size={12} aria-hidden="true" className="inline-lock" /> closed
              </>
            )}
          </span>
        )}
      </div>
      <span className={`transaction-amount ${AMOUNT_CLASS[tx.type]}`}>
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
  // Every row opens the edit sheet, including a closed cycle's — a past
  // quincena's transactions must stay correctable (payment method,
  // category, amount, date...). Only *deleting* stays blocked on a closed
  // cycle (see QuickAddSheet/deleteTransactionAction) — removing a row
  // outright is a step further than correcting one of its fields in place.
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
  incomeCategoryNames,
  cycleStartDate,
  emptyMessage = "Nothing logged yet this quincena.",
  groupByDate = false,
}: {
  transactions: CycleTransactionSummary[];
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  incomeCategoryNames: string[];
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
      cycleId: tx.cycleId,
      type: tx.type,
      name: tx.name,
      categoryName: tx.categoryName,
      amount: tx.amount,
      paymentMethod: tx.paymentMethod,
      occurredAt: formatCycleLabel(tx.occurredAt),
      description: tx.description,
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
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          editingTransaction={editing}
          returnFocusTo={triggerElement}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
