"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { editCyclePayInfoAction } from "../actions";
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
 * Corrects the current cycle's already-recorded pay amount/date in place —
 * distinct from ConfirmJustGotPaidSheet, which always closes the cycle and
 * starts a new one. Pre-filled with what's already stored, so opening and
 * immediately saving is a no-op.
 */
export function EditPayInfoSheet({
  initialAmount,
  initialPayDate,
  onDone,
  returnFocusTo = null,
}: {
  initialAmount: number;
  /** "YYYY-MM-DD" — the cycle's current periodStart. */
  initialPayDate: string;
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
  const sheetRef = useRef<HTMLDivElement>(null);

  // The min bound has to cover the cycle's own current periodStart (which
  // can be up to a full quincena old), not just the last few days.
  const minDate = formatCycleLabel(daysAgo(EDIT_PAY_DATE_LOOKBACK_DAYS));
  const maxDate = formatCycleLabel();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
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
    if (!payDate || payDate < minDate || payDate > maxDate) {
      setError(`Date must be between ${minDate} and ${maxDate}`);
      setErrorField("date");
      return;
    }
    setPending(true);
    setError(null);
    setErrorField(null);
    const fd = new FormData();
    fd.set("netQuincenaAmount", amount);
    fd.set("payDate", payDate);
    const result = await editCyclePayInfoAction(fd);

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
          Corrects this quincena&apos;s amount and start date in place — it won&apos;t start a new
          quincena.
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

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </button>
        </form>

        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleClose}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
