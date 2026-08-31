"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { getRecurringExpensePaymentStatus, type RecurringExpensePaymentStatus } from "@/lib/recurring-expense-status";
import { confirmRecurringExpenseMatchAction } from "../recurring-actions";
import { RecordPaymentSheet } from "./RecordPaymentSheet";
import { RecurringExpenseEditSheet, type EditableRecurringExpense } from "./RecurringExpenseEditSheet";
import { useSheet } from "../../_components/useSheet";
import { dismissMatch, isMatchDismissed } from "@/lib/dismissed-matches";

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
  showCategoryLabel = false,
  simplifiedStatus = false,
}: {
  expense: RecurringExpenseRowData;
  categoryName: string;
  categoryNames: string[];
  /** History reuses this for a closed cycle -- no edit sheet, no Record payment, no match actions, just the status. */
  readOnly?: boolean;
  /** Plan's flat bills list has no category-folder parent anymore, so each row names its own category inline -- CategoryProgressRow's own grouped usage (History, and a category with 2+ bills) leaves this off since the parent already says it. */
  showCategoryLabel?: boolean;
  /** Plan's own bill list (BillsSection) -- a dot/check indicator and a
   * faint tone for paid rows instead of the full not-started/partial/
   * paid/paid-over/exceeded status-chip row History and /budget's
   * CategoryProgressRow still show. Design system handoff's Plan spec. */
  simplifiedStatus?: boolean;
}) {
  const router = useRouter();
  const editSheet = useSheet();
  const paymentSheet = useSheet();
  const [dismissedMatch, setDismissedMatch] = useState(
    () => expense.suggestedMatch !== null && isMatchDismissed(expense.id, expense.suggestedMatch.transactionId),
  );
  const [confirmingMatch, setConfirmingMatch] = useState(false);

  const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
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
        {showCategoryLabel && (
          <span className="recurring-expense-row-category"> · {categoryName}</span>
        )}
        {expense.frequency === "MONTHLY" && expense.dueDay !== null && (
          <span className="recurring-expense-row-due"> · Due day {expense.dueDay}</span>
        )}
      </span>
      <span className="recurring-expense-row-amount">{formatCurrency(expense.targetAmount)}</span>
    </>
  );

  // "paid" here folds paid/paid-over/exceeded together -- Plan's simplified
  // row is a binary paid/unpaid indicator, unlike the full 5-state status
  // chip History and /budget's CategoryProgressRow still show.
  const isPaid = status === "paid" || status === "paid-over" || status === "exceeded";

  if (simplifiedStatus) {
    const meta = [showCategoryLabel ? categoryName : null, expense.dueDay !== null ? `due day ${expense.dueDay}` : null]
      .filter((part): part is string => part !== null)
      .join(" · ");
    return (
      <div className={`recurring-expense-row recurring-expense-row--simplified ${isPaid ? "recurring-expense-row--paid" : ""}`}>
        <button type="button" className="recurring-expense-row-main" {...editSheet.triggerProps}>
          <span className="recurring-expense-row-indicator" aria-hidden="true">
            {isPaid ? <Check size={16} /> : null}
          </span>
          <span className="recurring-expense-row-body">
            <span className="recurring-expense-row-name">{expense.name}</span>
            {meta && <span className="recurring-expense-row-meta">{meta}</span>}
          </span>
          <span className="recurring-expense-row-amount">{formatCurrency(expense.targetAmount)}</span>
        </button>
        {!isPaid && (
          <button type="button" className="button button--chip" {...paymentSheet.triggerProps}>
            Record
          </button>
        )}

        {editSheet.open && (
          <RecurringExpenseEditSheet
            categoryNames={categoryNames}
            existing={editable}
            onDone={editSheet.close}
            {...editSheet.sheetProps}
          />
        )}
        {paymentSheet.open && (
          <RecordPaymentSheet
            recurringExpenseId={expense.id}
            name={expense.name}
            targetAmount={expense.targetAmount}
            onDone={paymentSheet.close}
            {...paymentSheet.sheetProps}
          />
        )}
      </div>
    );
  }

  return (
    <div className="recurring-expense-row">
      {readOnly ? (
        <div className="recurring-expense-row-main recurring-expense-row-main--static">{nameAmountContent}</div>
      ) : (
        <button type="button" className="recurring-expense-row-main" {...editSheet.triggerProps}>
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
              onClick={() => {
                setDismissedMatch(true);
                if (expense.suggestedMatch) dismissMatch(expense.id, expense.suggestedMatch.transactionId);
              }}
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
            <button type="button" className="button button--secondary button--small" {...paymentSheet.triggerProps}>
              Record payment
            </button>
          )}
        </div>
      )}

      {!readOnly && editSheet.open && (
        <RecurringExpenseEditSheet
          categoryNames={categoryNames}
          existing={editable}
          onDone={editSheet.close}
          {...editSheet.sheetProps}
        />
      )}
      {!readOnly && paymentSheet.open && (
        <RecordPaymentSheet
          recurringExpenseId={expense.id}
          name={expense.name}
          targetAmount={expense.targetAmount}
          onDone={paymentSheet.close}
          {...paymentSheet.sheetProps}
        />
      )}
    </div>
  );
}
