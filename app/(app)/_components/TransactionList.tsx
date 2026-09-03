"use client";

import { Fragment, useState } from "react";
import dynamic from "next/dynamic";
import { HelpCircle, Lock, Wallet } from "lucide-react";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { groupTransactionsByDate } from "@/lib/transaction-grouping";
import { PAYMENT_METHOD_LABEL } from "@/lib/payment-method";
import { CategoryIcon } from "@/lib/category-icons";
import { useSheet } from "./useSheet";
import { EmptyState } from "./EmptyState";
import type { EditingTransaction } from "./QuickAddSheet";
import { useT, useVocab } from "../../_components/LocaleProvider";

// See BottomNav's own comment -- same lazy-loaded QuickAddSheet, same reason.
const QuickAddSheet = dynamic(() => import("./QuickAddSheet").then((mod) => mod.QuickAddSheet));

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
  const t = useT();
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
        ? t.transactions.filters.uncategorized
        : null,
    tx.paymentMethod ? PAYMENT_METHOD_LABEL[tx.paymentMethod] : null,
    showCycleLabel && tx.cycleLabel ? tx.cycleLabel : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const isClosed = tx.isEditable === false;
  const isUncategorized = tx.categoryName === null;

  return (
    <>
      {/* Uncategorized -> HelpCircle in amber; income -> Wallet in green;
          everything else -> the category's own icon, navy -- see the
          design system handoff's Assets section. Chip fill stays the
          standard #eef0f3 in every case; only the icon's color/glyph
          changes. */}
      <span className={`transaction-icon-chip ${isUncategorized ? "transaction-icon-chip--uncategorized" : ""}`}>
        {isUncategorized ? (
          <HelpCircle size={18} aria-hidden="true" />
        ) : tx.type === "INCOME" ? (
          <Wallet size={18} aria-hidden="true" className="transaction-icon-chip-income" />
        ) : (
          <CategoryIcon name={tx.categoryName ?? tx.name} size={18} aria-hidden="true" />
        )}
      </span>
      <div className="transaction-meta">
        <span className="transaction-name">{tx.name}</span>
        {(subline || isClosed) && (
          <span className={`transaction-sub ${isUncategorized ? "transaction-sub--uncategorized" : ""}`}>
            {isUncategorized ? t.transactions.needsCategory : subline}
            {isClosed && (
              <>
                {subline && " · "}
                <Lock size={12} aria-hidden="true" className="inline-lock" /> {t.transactions.closedTag}
              </>
            )}
          </span>
        )}
      </div>
      {/* SAVINGS is the one type whose stored amount can itself be
          negative -- a withdrawal (see EditGoalSheet's "record as
          withdrawal" option), stored as a real negative-amount
          CycleTransaction rather than a silent manualAdjustment
          correction. Deriving the sign from tx.amount itself (not just
          tx.type) means a withdrawal reads as "+" (money moving back to
          spendable balance, same direction as amountLeft's own formula
          treats it) instead of double-negating into "--$50.00". */}
      <span className={`transaction-amount ${AMOUNT_CLASS[tx.type]}`}>
        {tx.type === "INCOME" || tx.amount < 0 ? "+" : "-"}
        {formatCurrency(Math.abs(tx.amount))}
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
  emptyMessage,
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
  const { sheetProps, setTrigger } = useSheet();
  const t = useT();
  const vocab = useVocab();

  if (transactions.length === 0) {
    return <EmptyState>{emptyMessage ?? t.transactions.nothingLoggedThisQuincena(vocab)}</EmptyState>;
  }

  function handleEdit(tx: CycleTransactionSummary, trigger: HTMLElement) {
    setTrigger(trigger);
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
      recurringExpenseId: tx.recurringExpenseId,
    });
  }

  // Grouping also drops the per-row cycle label — the group header already
  // conveys the transaction's actual date, so repeating a cycle's start
  // date per row (which isn't even the same thing) is just noise.
  const showCycleLabel = !groupByDate;

  return (
    <div>
      {groupByDate ? (
        groupTransactionsByDate(transactions, { today: t.transactions.today, yesterday: t.transactions.yesterday }).map((group) => {
          // A savings contribution counts toward "out," same convention
          // the Activity summary line and HeroCard's safeToSpend use --
          // it's still money leaving spendable balance, even though it
          // isn't spending.
          const net = group.items.reduce(
            (sum, tx) => sum + (tx.type === "INCOME" ? tx.amount : -tx.amount),
            0,
          );
          return (
            <Fragment key={group.label + group.items[0].id}>
              <div className="transaction-date-group">
                <h3>{group.label}</h3>
                <span className={`transaction-date-net ${net >= 0 ? "transaction-date-net--good" : ""}`}>
                  {net >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(net))}
                </span>
              </div>
              {group.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} showCycleLabel={showCycleLabel} onEdit={handleEdit} />
              ))}
            </Fragment>
          );
        })
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
          {...sheetProps}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
