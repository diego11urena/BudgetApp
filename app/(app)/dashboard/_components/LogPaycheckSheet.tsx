"use client";

import { useEffect, useId, useState } from "react";
import { logPaycheckAction } from "../actions";
import { Sheet } from "../../_components/Sheet";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { formatCycleLabel, nowInPanama, PAY_DATE_LOOKBACK_DAYS } from "@/lib/pay-date";
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
}: {
  onDone: () => void;
  onCancel: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useT().dashboard;
  const [visible, setVisible] = useState(false);
  // "0.00" (not "") to match CurrencyInput's own displayed default when
  // untouched (it floors at "0.00" rather than rendering blank) -- keeps
  // this state and what's visually shown from disagreeing, so an
  // accidental submit-without-typing surfaces "must be positive" (matches
  // what's on screen) rather than a confusing "invalid format" error for
  // a field that visibly already shows a validly-formatted "0.00".
  const [amount, setAmount] = useState("0.00");
  const [payDate, setPayDate] = useState(() => formatCycleLabel(nowInPanama()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const amountId = `${uid}-amount`;
  const dateId = `${uid}-date`;
  const errorId = `${uid}-error`;

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

  return (
    <Sheet
      visible={visible}
      title={t.logPaycheck.title}
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
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
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        {t.logPaycheck.body}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor={amountId}>{t.netPayLabel}</label>
          <CurrencyInput
            id={amountId}
            defaultValue={amount}
            onValueChange={setAmount}
            className="sheet-amount-input"
          />
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
