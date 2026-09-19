"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { ScheduledRecurringExpenseStatus, OngoingRecurringExpenseStatus } from "@/lib/recurring-expense-status";
import { confirmRecurringExpenseMatchAction } from "../recurring-actions";
import { RecordPaymentSheet } from "./RecordPaymentSheet";
import { RecurringExpenseEditSheet, type EditableRecurringExpense } from "./RecurringExpenseEditSheet";
import { useSheet } from "../../_components/useSheet";
import { dismissMatch, isMatchDismissed } from "@/lib/dismissed-matches";
import { useT } from "@/app/_components/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/dictionary";

export interface RecurringExpenseRowData {
  id: string;
  name: string;
  /** Scheduled: the real target. Ongoing: a typical/estimated amount -- see hasFixedDate. */
  targetAmount: number;
  actual: number;
  recurring: boolean;
  /** Scheduled (true, a real due date) vs Ongoing (false, recurs but no set date). */
  hasFixedDate: boolean;
  dueDay: number | null;
  status: ScheduledRecurringExpenseStatus | OngoingRecurringExpenseStatus;
  suggestedMatch: { transactionId: string; name: string; amount: number } | null;
}

function scheduledStatusLabel(status: ScheduledRecurringExpenseStatus, t: Dictionary): string {
  const STATUS_LABEL: Record<ScheduledRecurringExpenseStatus, string> = {
    "not-started": t.budget.status.notPaid,
    partial: t.budget.status.partiallyPaid,
    paid: t.budget.status.paid,
    "paid-over": t.budget.status.paidOverTarget,
    exceeded: t.budget.status.exceeded,
  };
  return STATUS_LABEL[status];
}

function ongoingStatusLabel(status: OngoingRecurringExpenseStatus, t: Dictionary): string {
  return status === "logged" ? t.budget.status.logged : t.budget.status.notLogged;
}

/** Settled = nothing more to do about it this cycle -- Scheduled's paid/paid-over/exceeded folded together, Ongoing's own single "logged." Drives the simplified row's dot-vs-check indicator and faint "already handled" tone; Scheduled's own full row still shows its 5-state chip, not this folded version. */
function isSettled(expense: RecurringExpenseRowData): boolean {
  return expense.hasFixedDate
    ? expense.status === "paid" || expense.status === "paid-over" || expense.status === "exceeded"
    : expense.status === "logged";
}

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
  /** The Recurring tab's flat lists have no category-folder parent anymore, so each row names its own category inline -- CategoryProgressRow's own grouped usage (History, and a category with 2+ items) leaves this off since the parent already says it. */
  showCategoryLabel?: boolean;
  /** The Recurring tab's own lists (RecurringSection) -- a dot/check indicator and a
   * faint tone for settled rows instead of the full not-started/partial/
   * paid/paid-over/exceeded status-chip row History and /budget's
   * CategoryProgressRow still show. Design system handoff's Plan spec. */
  simplifiedStatus?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const editSheet = useSheet();
  const paymentSheet = useSheet();
  const [dismissedMatch, setDismissedMatch] = useState(
    () => expense.suggestedMatch !== null && isMatchDismissed(expense.id, expense.suggestedMatch.transactionId),
  );
  const [confirmingMatch, setConfirmingMatch] = useState(false);

  // "not-started" (Scheduled) / "not-logged" (Ongoing) -- the two "nothing
  // recorded yet" statuses a suggestion is worth surfacing for. Anything
  // further along (partial, paid, logged, ...) means the user has already
  // acted on this one, so a suggestion is either moot or would be
  // second-guessing a real payment they already recorded some other way.
  const showSuggestion =
    !readOnly &&
    expense.suggestedMatch !== null &&
    !dismissedMatch &&
    (expense.status === "not-started" || expense.status === "not-logged");

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
    hasFixedDate: expense.hasFixedDate,
    dueDay: expense.dueDay,
  };

  const nameAmountContent = (
    <>
      <span className="recurring-expense-row-name">
        {expense.name}
        {showCategoryLabel && (
          <span className="recurring-expense-row-category"> · {categoryName}</span>
        )}
        {expense.hasFixedDate && expense.dueDay !== null && (
          <span className="recurring-expense-row-due">{t.budget.dueDay(expense.dueDay)}</span>
        )}
      </span>
      <span className="recurring-expense-row-amount">
        {/* "~" marks an Ongoing item's amount as a typical/estimated one, not
            an exact target -- a plain typographic symbol, not language-
            specific text, so it isn't routed through the dictionary. */}
        {!expense.hasFixedDate && "~"}
        {formatCurrency(expense.targetAmount)}
      </span>
    </>
  );

  const settled = isSettled(expense);

  if (simplifiedStatus) {
    // t.budget.dueDay() carries its own leading " · " separator (meant for
    // appending directly after a name) -- stripped here since this meta
    // line joins its parts with " · " itself, same as before wiring.
    const dueDayMeta =
      expense.hasFixedDate && expense.dueDay !== null ? t.budget.dueDay(expense.dueDay).replace(/^\s*·\s*/, "") : null;
    const meta = [showCategoryLabel ? categoryName : null, dueDayMeta]
      .filter((part): part is string => part !== null)
      .join(" · ");
    return (
      <div className={`recurring-expense-row recurring-expense-row--simplified ${settled ? "recurring-expense-row--paid" : ""}`}>
        <div className="recurring-expense-row--simplified-top">
          <button type="button" className="recurring-expense-row-main" {...editSheet.triggerProps}>
            <span className="recurring-expense-row-indicator" aria-hidden="true">
              {settled ? <Check size={16} /> : null}
            </span>
            <span className="recurring-expense-row-body">
              <span className="recurring-expense-row-name">{expense.name}</span>
              {meta && <span className="recurring-expense-row-meta">{meta}</span>}
            </span>
            <span className="recurring-expense-row-amount">
              {!expense.hasFixedDate && "~"}
              {formatCurrency(expense.targetAmount)}
            </span>
          </button>
          {/* A pending suggestion below takes over "how to settle this" --
              Record still works for a Scheduled item once settled removes
              it, but Ongoing keeps Record available regardless (there's no
              target to "finish" -- a second haircut mid-cycle is still a
              real payment to log), and leading with Confirm/Not this one
              avoids putting two competing calls to action in front of the
              user while a suggestion is pending. */}
          {(!expense.hasFixedDate || !settled) && !showSuggestion && (
            <button type="button" className="button button--chip" {...paymentSheet.triggerProps}>
              {t.budget.record}
            </button>
          )}
        </div>

        {showSuggestion && (
          <div className="recurring-expense-suggestion">
            <p className="field-hint">
              {t.budget.possibleMatch(expense.suggestedMatch!.name, formatCurrency(expense.suggestedMatch!.amount))}
            </p>
            <div className="recurring-expense-suggestion-actions">
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={handleConfirmMatch}
                disabled={confirmingMatch}
              >
                {confirmingMatch ? t.budget.confirming : t.budget.confirmMatch}
              </button>
              <button
                type="button"
                className="button button--secondary button--small"
                onClick={() => {
                  setDismissedMatch(true);
                  if (expense.suggestedMatch) dismissMatch(expense.id, expense.suggestedMatch.transactionId);
                }}
              >
                {t.budget.notThisOne}
              </button>
            </div>
          </div>
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
            {t.budget.possibleMatch(expense.suggestedMatch!.name, formatCurrency(expense.suggestedMatch!.amount))}
          </p>
          <div className="recurring-expense-suggestion-actions">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={handleConfirmMatch}
              disabled={confirmingMatch}
            >
              {confirmingMatch ? t.budget.confirming : t.budget.confirmMatch}
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                setDismissedMatch(true);
                if (expense.suggestedMatch) dismissMatch(expense.id, expense.suggestedMatch.transactionId);
              }}
            >
              {t.budget.notThisOne}
            </button>
          </div>
        </div>
      ) : expense.hasFixedDate ? (
        <div className={`recurring-expense-status recurring-expense-status--${expense.status}`}>
          <span className="recurring-expense-status-label">
            {/* Safe cast: this branch is gated on expense.hasFixedDate,
                which getRecurringExpensesForCycle guarantees pairs with a
                ScheduledRecurringExpenseStatus (see RecurringExpenseWithStatus's own doc comment). */}
            {scheduledStatusLabel(expense.status as ScheduledRecurringExpenseStatus, t)}
          </span>
          {expense.status !== "not-started" && (
            <span className="recurring-expense-status-amount">
              {formatCurrency(expense.actual)} / {formatCurrency(expense.targetAmount)}
            </span>
          )}
          {!readOnly && (expense.status === "not-started" || expense.status === "partial") && (
            <button type="button" className="button button--secondary button--small" {...paymentSheet.triggerProps}>
              {t.budget.recordPaymentButton}
            </button>
          )}
        </div>
      ) : (
        // Ongoing: no amount comparison, no over/under coloring -- its own
        // amount is a typical/estimated one, not a real target (see
        // OngoingRecurringExpenseStatus's own doc comment). Just whether a
        // payment has been logged this cycle, and Record stays available
        // either way (no target to "finish").
        <div className={`recurring-expense-status recurring-expense-status--${expense.status}`}>
          <span className="recurring-expense-status-label">
            {/* Safe cast: the mirror-image case of the Scheduled branch
                above -- !expense.hasFixedDate guarantees an
                OngoingRecurringExpenseStatus here. */}
            {ongoingStatusLabel(expense.status as OngoingRecurringExpenseStatus, t)}
          </span>
          {expense.status === "logged" && (
            <span className="recurring-expense-status-amount">{formatCurrency(expense.actual)}</span>
          )}
          {!readOnly && (
            <button type="button" className="button button--secondary button--small" {...paymentSheet.triggerProps}>
              {t.budget.recordPaymentButton}
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
