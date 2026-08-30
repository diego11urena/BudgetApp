"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { editCyclePayInfoAction, previewPayDateChangeAction } from "../actions";
import type { PayDateChangeResult } from "@/lib/cycles";
import { Sheet } from "../../_components/Sheet";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { addDays, FIRST_CYCLE_BACKDATE_FLOOR_DAYS, formatCycleLabel, nowInPanama } from "@/lib/pay-date";
import { AMOUNT_NOT_POSITIVE_MESSAGE, validateAmountFormat } from "@/lib/validations/shared";

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
  const uid = useId();
  const amountId = `${uid}-amount`;
  const dateId = `${uid}-date`;
  const errorId = `${uid}-error`;

  // The lower bound always comes from this cycle's own previous neighbor
  // (null only for the account's very first cycle ever) — same boundary
  // assessPayDateChange itself enforces, whether this cycle is open or
  // closed. For that one no-previous case, mirror assessPayDateChange's
  // own backdate floor here too, so the date picker itself hints at the
  // same bound the server will actually enforce. The upper bound differs:
  // a closed cycle is capped by its own next neighbor's start, but the
  // current draft cycle has no "next" cycle to bound it (nothing exists
  // after it yet), so it's capped at today instead — a draft cycle's pay
  // date can't be in the future.
  const minDate = previousBoundDate ?? formatCycleLabel(addDays(nowInPanama(), -FIRST_CYCLE_BACKDATE_FLOOR_DAYS));
  const maxDate = closed ? (nextBoundDate ?? undefined) : formatCycleLabel(nowInPanama());

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
    const amountFormatError = validateAmountFormat(amount);
    if (amountFormatError) {
      setError(amountFormatError);
      setErrorField("amount");
      return;
    }
    if (Number(amount) <= 0) {
      setError(AMOUNT_NOT_POSITIVE_MESSAGE);
      setErrorField("amount");
      return;
    }
    if (!payDate) {
      setError("Date is required");
      setErrorField("date");
      return;
    }
    if (payDate < minDate || payDate > (maxDate ?? "")) {
      const maxLabel = maxDate ?? "today";
      setError(`Date must be between ${minDate} and ${maxLabel}`);
      setErrorField("date");
      return;
    }

    // A pay-date change can reassign transactions across the cycle
    // boundary — preview it and ask before committing, same "don't move it
    // silently" principle QuickAddSheet's cross-cycle move confirmation
    // uses. Net pay by itself needs no such safeguard, so this is skipped
    // entirely when the date hasn't changed. Applies to the open draft
    // cycle exactly the same as a closed one — correcting a pay date
    // should behave the same regardless of cycle status.
    if (cycleId && payDate !== initialPayDate) {
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

  return (
    <Sheet
      visible={visible}
      title="Edit pay info"
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        {closed
          ? "Corrects this quincena's amount and start date in place."
          : "Corrects this quincena's amount and start date in place — it won't start a new quincena."}
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={amountId}>Net pay (USD)</label>
          <CurrencyInput
            id={amountId}
            defaultValue={amount}
            onValueChange={setAmount}
            className={`sheet-amount-input ${errorField === "amount" ? "is-invalid" : ""}`}
            invalid={errorField === "amount"}
            describedBy={errorField === "amount" ? errorId : undefined}
          />
        </div>

        <div className="field">
          <label htmlFor={dateId}>Pay date</label>
          <input
            id={dateId}
            type="date"
            value={payDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => setPayDate(e.target.value)}
            className={errorField === "date" ? "is-invalid" : ""}
            aria-invalid={errorField === "date" || undefined}
            aria-describedby={errorField === "date" ? errorId : undefined}
          />
        </div>

        {error && (
          <p id={errorId} className="error-text" role="alert">
            {error}
          </p>
        )}

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
    </Sheet>
  );
}
