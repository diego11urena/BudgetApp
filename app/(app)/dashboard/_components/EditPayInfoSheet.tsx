"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editCyclePayInfoAction, previewPayDateChangeAction } from "../actions";
import type { PayDateChangeResult } from "@/lib/cycles";
import { useModalFocus } from "../../_components/useModalFocus";
import { formatCycleLabel } from "@/lib/pay-date";
import { AMOUNT_NOT_POSITIVE_MESSAGE, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";

const EDIT_PAY_DATE_LOOKBACK_DAYS = 30;

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Corrects a cycle's already-recorded pay amount/date in place — distinct
 * from ConfirmJustGotPaidSheet, which always closes the cycle and starts a
 * new one. Pre-filled with what's already stored, so opening and
 * immediately saving is a no-op. Used both for the current draft cycle
 * (Home) and, via cycleId/closed, for an arbitrary past closed cycle from
 * its own page.
 */
export function EditPayInfoSheet({
  initialAmount,
  initialPayDate,
  cycleId,
  closed = false,
  previousBoundDate = null,
  nextBoundDate = null,
  onDone,
  returnFocusTo = null,
}: {
  initialAmount: number;
  /** "YYYY-MM-DD" — the cycle's current periodStart. */
  initialPayDate: string;
  cycleId?: string;
  closed?: boolean;
  previousBoundDate?: string | null;
  nextBoundDate?: string | null;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(initialAmount.toFixed(2));
  const [payDate, setPayDate] = useState(initialPayDate);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"amount" | "date" | null>(null);
  /** Set when a pay-date change would reassign transactions — blocks the real submit until Continue/Cancel. */
  const [pendingMove, setPendingMove] = useState<
    Extract<PayDateChangeResult, { ok: true }> | null
  >(null);
  const [movePending, setMovePending] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // The min bound has to cover the cycle's own current periodStart (which
  // can be up to a full quincena old), not just the last few days. Only
  // used for the current draft cycle — a closed cycle's valid range comes
  // from its own neighbors instead (previousBoundDate/nextBoundDate).
  const minDate = closed ? (previousBoundDate ?? undefined) : formatCycleLabel(daysAgo(EDIT_PAY_DATE_LOOKBACK_DAYS));
  const maxDate = closed ? (nextBoundDate ?? undefined) : formatCycleLabel();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("netQuincenaAmount", amount);
    fd.set("payDate", payDate);
    if (cycleId) fd.set("cycleId", cycleId);
    return fd;
  }

  async function submitEdit() {
    setPending(true);
    setError(null);
    setErrorField(null);
    const result = await editCyclePayInfoAction(buildFormData());

    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }

    setPending(false);
    // revalidatePath alone isn't reliably enough to refresh an already-
    // mounted client tree across every environment — explicit refresh so
    // Home's days-remaining/pace/etc. update the moment this sheet closes.
    router.refresh();
    handleClose();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Explicit checks instead of relying on the amount/date inputs' native
    // required/min/max — those silently block submission with no in-app
    // feedback (the form has noValidate specifically so this runs instead).
    if (!amount.trim() || Number.isNaN(Number(amount))) {
      setError(INVALID_AMOUNT_FORMAT_MESSAGE);
      setErrorField("amount");
      return;
    }
    if (Number(amount) <= 0) {
      setError(AMOUNT_NOT_POSITIVE_MESSAGE);
      setErrorField("amount");
      return;
    }
    if (!closed && (!payDate || payDate < (minDate ?? "") || payDate > (maxDate ?? ""))) {
      setError(`Date must be between ${minDate} and ${maxDate}`);
      setErrorField("date");
      return;
    }
    if (!payDate) {
      setError("Date is required");
      setErrorField("date");
      return;
    }

    // A closed cycle's pay-date change can reassign transactions — preview
    // it and ask before committing, same "don't move it silently"
    // principle QuickAddSheet's cross-cycle move confirmation uses. Net
    // pay by itself needs no such safeguard, so this is skipped entirely
    // when the date hasn't changed.
    if (closed && cycleId && payDate !== initialPayDate) {
      const preview = await previewPayDateChangeAction(cycleId, payDate);
      if (!preview.ok) {
        setError(preview.error);
        setErrorField("date");
        return;
      }
      if (preview.changed && preview.movingCount > 0) {
        setPendingMove(preview);
        return;
      }
    }

    await submitEdit();
  }

  async function handleConfirmMove() {
    setPendingMove(null);
    setMovePending(true);
    await submitEdit();
    setMovePending(false);
  }

  function handleCancelMove() {
    setPendingMove(null);
    setPayDate(initialPayDate);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Edit this quincena's pay info"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Edit pay info</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          {closed
            ? "Corrects this quincena's amount and start date in place."
            : "Corrects this quincena's amount and start date in place — it won't start a new quincena."}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="edit-pay-amount">Net pay (USD)</label>
            <input
              id="edit-pay-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`sheet-amount-input ${errorField === "amount" ? "is-invalid" : ""}`}
              onFocus={(e) => e.target.select()}
            />
          </div>

          <div className="field">
            <label htmlFor="edit-pay-date">Pay date</label>
            <input
              id="edit-pay-date"
              type="date"
              value={payDate}
              min={minDate}
              max={maxDate}
              onChange={(e) => setPayDate(e.target.value)}
              className={errorField === "date" ? "is-invalid" : ""}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          {pendingMove && pendingMove.changed && (
            <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              This will move {pendingMove.movingCount} transaction
              {pendingMove.movingCount === 1 ? "" : "s"} {pendingMove.direction === "in" ? "into" : "out of"}{" "}
              this quincena, {pendingMove.direction === "in" ? "from" : "to"} {pendingMove.otherCycleLabel}.
              Continue?
            </p>
          )}

          {pendingMove ? (
            <>
              <button
                type="button"
                className="button sheet-submit"
                disabled={movePending}
                onClick={handleConfirmMove}
              >
                {movePending ? "Saving..." : "Continue"}
              </button>
              <button
                type="button"
                className="button button--secondary sheet-submit"
                disabled={movePending}
                onClick={handleCancelMove}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="submit" className="button sheet-submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </button>
          )}
        </form>

        {!pendingMove && (
          <button
            type="button"
            className="button button--secondary sheet-submit"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
