"use client";

import { useEffect, useId, useState } from "react";
import { logPaycheckAction } from "../actions";
import { Sheet } from "../../_components/Sheet";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { MoneyField } from "../../_components/MoneyField";
import { formatCycleLabel, nowInPanama, PAY_DATE_LOOKBACK_DAYS } from "@/lib/pay-date";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/app/_components/LocaleProvider";

// Based on Panama time, not the device's own local clock -- same as
// ConfirmJustGotPaidSheet/EditPayInfoSheet's own copy of this helper.
function daysAgo(days: number): Date {
  const date = nowInPanama();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * MONTHLY-budget accounts only: logs one paycheck into the currently open
 * cycle additively (see lib/cycles.ts's logPaycheckToOpenCycle) -- doesn't
 * close anything, so amount and date are collected together in one step
 * here, unlike QUINCENAL's two-step close-then-confirm-amount flow
 * (ConfirmJustGotPaidSheet -> CycleClosedCard -> NewCycleIncomeSheet).
 * There's no "carried forward" placeholder amount to correct afterward --
 * nothing is written until both values exist.
 */
export function LogPaycheckSheet({
  onDone,
  onCancel,
  returnFocusTo = null,
  paycheckNumber,
  expectedPaychecks,
  usualAmount,
  currentIncome,
  periodName,
}: {
  onDone: () => void;
  onCancel: () => void;
  returnFocusTo?: HTMLElement | null;
  /** Which paycheck this is (1-based) -- drives the "Paycheck 2 of 2" kicker. */
  paycheckNumber: number;
  expectedPaychecks: number;
  /** The user's usual paycheck, used to prefill the amount. 0 when unknown, in which case nothing is prefilled. */
  usualAmount: number;
  /** Income already logged into this cycle, for the preview strip's "before" figure. */
  currentIncome: number;
  /** The period's own name ("September"), for the preview strip. */
  periodName: string;
}) {
  const t = useT().dashboard;
  const [visible, setVisible] = useState(false);
  // "0.00" (not "") to match CurrencyInput's own displayed default when
  // untouched (it floors at "0.00" rather than rendering blank) -- keeps
  // this state and what's visually shown from disagreeing, so an
  // accidental submit-without-typing surfaces "must be positive" (matches
  // what's on screen) rather than a confusing "invalid format" error for
  // a field that visibly already shows a validly-formatted "0.00".
  // Prefilled from the usual paycheck rather than starting at zero: the
  // second paycheck of a month is almost always the same as the first, so
  // zero asks the user to retype a number the app already knows. The
  // helper line under the field says it is a prefill, so an unusual month
  // reads as something to correct rather than something already committed.
  const [amount, setAmount] = useState(() => (usualAmount > 0 ? usualAmount.toFixed(2) : "0.00"));
  const [payDate, setPayDate] = useState(() => formatCycleLabel(nowInPanama()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const amountId = `${uid}-amount`;
  const dateId = `${uid}-date`;
  const errorId = `${uid}-error`;

  const amountNumber = Number(amount) || 0;
  const minDate = formatCycleLabel(daysAgo(PAY_DATE_LOOKBACK_DAYS));
  const maxDate = formatCycleLabel(nowInPanama());

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleCancel() {
    if (pending) return;
    setVisible(false);
    setTimeout(onCancel, 200);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // No <form action> here (this submits via the action function
    // directly, not native form submission), so the date input's min/max
    // never get a chance to block anything on their own -- same reasoning
    // as ConfirmJustGotPaidSheet's own identical check.
    if (payDate < minDate || payDate > maxDate) {
      setError(t.editPayInfo.dateRange(minDate, maxDate));
      return;
    }
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("netPayAmount", amount);
    fd.set("payDate", payDate);
    const result = await logPaycheckAction(fd);

    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }

    setPending(false);
    setVisible(false);
    setTimeout(onDone, 200);
  }

  // "September income  $790.00 → $1,580.00": the label sits left, the
  // figures right, and only the NEW total takes the income green.
  const beforeLabel = formatCurrency(currentIncome);
  const afterLabel = formatCurrency(currentIncome + amountNumber);
  const previewFull = t.logPaycheck.preview(periodName, beforeLabel, afterLabel);
  const previewLabel = previewFull.includes(beforeLabel) ? previewFull.slice(0, previewFull.indexOf(beforeLabel)).trim() : previewFull;

  return (
    <Sheet
      visible={visible}
      kicker={t.logPaycheck.kicker(paycheckNumber, expectedPaychecks)}
      title={t.logPaycheck.title}
      titleStyle={{ marginBottom: "0.5rem" }}
      onClose={handleCancel}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
      // Sheet's own default (true) auto-focuses the first focusable child
      // -- the amount field -- the instant this mounts, which is *before*
      // the slide-in transition even starts (useModalFocus's effect runs
      // on this component's first commit, one render ahead of the rAF
      // that flips `visible`/starts the CSS transition). That focus+the
      // field's own onFocus (select-all) firing while the panel is still
      // off-screen and animating is what produced a corrupted amount:
      // Playwright's click, arriving only once the transform has
      // stabilized ~300ms later, lands on an *already-focused* field and
      // collapses the select-all to wherever it clicked instead of a
      // clean caret-at-end, so the first few typed digits land mid-string
      // instead of appending. False here defers focus to that first real
      // click, same fix NeedsAttentionSheet already uses for its own
      // first-child text field.
      autoFocus={false}
    >
      <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
        {t.logPaycheck.body}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor={amountId}>{t.netPayLabel}</label>
<MoneyField size="lg">
            <CurrencyInput
              id={amountId}
              defaultValue={amount}
              onValueChange={setAmount}
            />
          </MoneyField>
          {usualAmount > 0 && <span className="field-hint">{t.logPaycheck.prefilledHint}</span>}
        </div>

        <div className="field">
          <label htmlFor={dateId}>{t.logPaycheck.dateLabel}</label>
          <input
            id={dateId}
            type="date"
            value={payDate}
            min={minDate}
            max={maxDate}
            disabled={pending}
            className={error ? "is-invalid" : ""}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setPayDate(e.target.value);
              setError(null);
            }}
          />
        </div>

        {/* What this paycheck does to the month's income, before it is
            committed -- the one number the user is actually deciding
            about is the total, not the entry. */}
        {amountNumber > 0 && (
          <p className="paycheck-preview">
            <span>{previewLabel}</span>
            <span className="paycheck-preview-value">
              {beforeLabel} → <span className="paycheck-preview-after">{afterLabel}</span>
            </span>
          </p>
        )}

        {error && (
          <p id={errorId} className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button sheet-submit" disabled={pending}>
          {pending ? t.logPaycheck.pending : t.logPaycheck.confirm}
        </button>
      </form>

      <button
        type="button"
        className="button button--secondary sheet-submit"
        onClick={handleCancel}
        disabled={pending}
      >
        {t.logPaycheck.cancel}
      </button>
    </Sheet>
  );
}
