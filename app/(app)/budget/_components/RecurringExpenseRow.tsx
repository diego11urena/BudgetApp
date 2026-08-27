"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";
import { getRecurringExpensePaymentStatus, type RecurringExpensePaymentStatus } from "@/lib/recurring-expense-status";
import { confirmRecurringExpenseMatchAction } from "../recurring-actions";
import { RecordPaymentSheet } from "./RecordPaymentSheet";
import { RecurringExpenseEditSheet, type EditableRecurringExpense } from "./RecurringExpenseEditSheet";

export interface RecurringExpenseRowData {
  id: string;
  name: string;
  targetAmount: number;
  actual: number;
  recurring: boolean;
  frequency: "BIWEEKLY" | "MONTHLY";
  dueDay: number | null;
  suggestedMatch: { transactionId: string; name: string; amount: number } | null;
}

const STATUS_LABEL: Record<RecurringExpensePaymentStatus, string> = {
  "not-started": "Not paid yet",
  partial: "Partially paid",
  paid: "Paid",
  "paid-over": "Paid — over target",
  exceeded: "Exceeded",
};

/**
 * One line item inside an expanded CategoryProgressRow. Tapping the
 * name/amount opens the edit sheet; the status line below is its own
 * region with independent actions (Record payment, or Confirm/Not this
 * one for a match suggestion) so those never trigger edit by accident.
 */
export function RecurringExpenseRow({
  expense,
  categoryName,
  categoryNames,
  readOnly = false,
}: {
  expense: RecurringExpenseRowData;
  categoryName: string;
  categoryNames: string[];
  /** History reuses this for a closed cycle -- no edit sheet, no Record payment, no match actions, just the status. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editTrigger, setEditTrigger] = useState<HTMLElement | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentTrigger, setPaymentTrigger] = useState<HTMLElement | null>(null);
  const [dismissedMatch, setDismissedMatch] = useState(false);
  const [confirmingMatch, setConfirmingMatch] = useState(false);

  const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
  // Dismissing a suggestion is local-only, not persisted -- it can
  // resurface next visit, deliberately simple (see
  // lib/recurring-expense-matching.ts).
  const showSuggestion = !readOnly && expense.suggestedMatch !== null && !dismissedMatch && status === "not-started";

  async function handleConfirmMatch() {
    if (!expense.suggestedMatch) return;
    setConfirmingMatch(true);
    const fd = new FormData();
    fd.set("transactionId", expense.suggestedMatch.transactionId);
    fd.set("recurringExpenseId", expense.id);
    await confirmRecurringExpenseMatchAction(fd);
    setConfirmingMatch(false);
    router.refresh();
  }

  const editable: EditableRecurringExpense = {
    id: expense.id,
    name: expense.name,
    targetAmount: expense.targetAmount,
    categoryName,
    recurring: expense.recurring,
    frequency: expense.frequency,
    dueDay: expense.dueDay,
  };

  const nameAmountContent = (
    <>
      <span className="recurring-expense-row-name">
        {expense.name}
        {expense.frequency === "MONTHLY" && expense.dueDay !== null && (
          <span className="recurring-expense-row-due"> · Due day {expense.dueDay}</span>
        )}
      </span>
      <span className="recurring-expense-row-amount">{formatCurrency(expense.targetAmount)}</span>
    </>
  );

  return (
    <div className="recurring-expense-row">
      {readOnly ? (
        <div className="recurring-expense-row-main recurring-expense-row-main--static">{nameAmountContent}</div>
      ) : (
        <button
          type="button"
          className="recurring-expense-row-main"
          onClick={(e) => {
            setEditTrigger(e.currentTarget);
            setEditing(true);
          }}
        >
          {nameAmountContent}
        </button>
      )}

      {showSuggestion ? (
        <div className="recurring-expense-suggestion">
          <p className="field-hint">
            Possible match: {expense.suggestedMatch!.name} · {formatCurrency(expense.suggestedMatch!.amount)}
          </p>
          <div className="recurring-expense-suggestion-actions">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={handleConfirmMatch}
              disabled={confirmingMatch}
            >
              {confirmingMatch ? "Confirming..." : "Confirm"}
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setDismissedMatch(true)}
            >
              Not this one
            </button>
          </div>
        </div>
      ) : (
        <div className={`recurring-expense-status recurring-expense-status--${status}`}>
          <span className="recurring-expense-status-label">{STATUS_LABEL[status]}</span>
          {status !== "not-started" && (
            <span className="recurring-expense-status-amount">
              {formatCurrency(expense.actual)} / {formatCurrency(expense.targetAmount)}
            </span>
          )}
          {!readOnly && (status === "not-started" || status === "partial") && (
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={(e) => {
                setPaymentTrigger(e.currentTarget);
                setRecordingPayment(true);
              }}
            >
              Record payment
            </button>
          )}
        </div>
      )}

      {!readOnly && editing && (
        <RecurringExpenseEditSheet
          categoryNames={categoryNames}
          existing={editable}
          onDone={() => setEditing(false)}
          returnFocusTo={editTrigger}
        />
      )}
      {!readOnly && recordingPayment && (
        <RecordPaymentSheet
          recurringExpenseId={expense.id}
          name={expense.name}
          targetAmount={expense.targetAmount}
          onDone={() => setRecordingPayment(false)}
          returnFocusTo={paymentTrigger}
        />
      )}
    </div>
  );
}
