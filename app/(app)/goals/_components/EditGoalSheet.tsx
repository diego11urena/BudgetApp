"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { updateGoalWithContributionAction } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { Sheet } from "../../_components/Sheet";
import { formatCurrency } from "@/lib/format";
import { validateAmountFormat } from "@/lib/validations/shared";
import { useT } from "@/app/_components/LocaleProvider";

export interface EditableGoal {
  categoryId: string;
  name: string;
  lifetimeTargetAmount: number;
  currentCycleRecurringAmount: number | null;
  savedSoFar: number;
}

/**
 * Edits an existing goal's name, total target, per-cycle contribution, and
 * "amount saved so far" — all committed together by one server action
 * (updateGoalWithContributionAction). The last field is the one with real
 * accounting implications: savedSoFar is always transactions +
 * manualAdjustment (see lib/goals.ts), never a raw editable number, so
 * changing it here always means changing one of those two terms -- either
 * direction asks whether to record it as a real transaction (money that
 * actually moved just now -- a contribution or a withdrawal, a negative-
 * amount SAVINGS CycleTransaction) or as a correction (manualAdjustment
 * only, doesn't touch transaction history -- e.g. backfilling a balance
 * that was never really tracked here, not money moving today).
 */
export function EditGoalSheet({
  goal,
  categoryNames,
  returnFocusTo = null,
  onDone,
}: {
  goal: EditableGoal;
  categoryNames: string[];
  returnFocusTo?: HTMLElement | null;
  onDone: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [lifetimeTargetAmount, setLifetimeTargetAmount] = useState(goal.lifetimeTargetAmount.toFixed(2));
  const [recurringAmount, setRecurringAmount] = useState(
    goal.currentCycleRecurringAmount !== null ? goal.currentCycleRecurringAmount.toFixed(2) : "",
  );
  const [savedSoFar, setSavedSoFar] = useState(goal.savedSoFar.toFixed(2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"name" | "target" | "saved" | null>(null);
  /** Set once the saved-so-far field's delta needs a decision before anything commits -- also carries the name value read at submit time, since CategoryNameInput is uncontrolled and can only be read from the DOM. */
  const [pendingChange, setPendingChange] = useState<{ name: string; delta: number } | null>(null);
  const uid = useId();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  /**
   * The one call behind every submit path here — base fields plus,
   * whenever savedSoFar changed, the resulting transaction-or-adjustment
   * write, all committed atomically server-side (see
   * updateGoalWithContributionAction's own comment for why this used to
   * be two separate round-trips and isn't anymore).
   */
  async function submitGoal(name: string, delta: number, recordAsTransaction: boolean) {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("categoryId", goal.categoryId);
      fd.set("name", name);
      fd.set("lifetimeTargetAmount", lifetimeTargetAmount);
      if (recurringAmount.trim()) fd.set("recurringAmount", recurringAmount);
      if (delta !== 0) {
        fd.set("delta", String(delta));
        fd.set("recordAsTransaction", recordAsTransaction ? "true" : "false");
      }
      const result = await updateGoalWithContributionAction(fd);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      handleClose();
    } catch {
      setError(t.goals.savedError);
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // CategoryNameInput is uncontrolled (manages its own value internally)
    // -- FormData reads its current DOM value directly rather than
    // needing it lifted into this component's own state.
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();

    // Explicit checks instead of relying on native input validation — same
    // pattern as every other sheet form in this app (noValidate below).
    if (!name) {
      setError(t.goals.nameRequired);
      setErrorField("name");
      return;
    }
    if (validateAmountFormat(lifetimeTargetAmount) || Number(lifetimeTargetAmount) <= 0) {
      setError(t.validations.invalidAmount);
      setErrorField("target");
      return;
    }
    // No separate `< 0` check needed -- validateAmountFormat's regex has no
    // sign, so anything that passes is already non-negative (savedSoFar,
    // unlike lifetimeTargetAmount, is allowed to be exactly 0).
    if (validateAmountFormat(savedSoFar)) {
      setError(t.validations.invalidAmount);
      setErrorField("saved");
      return;
    }
    setError(null);
    setErrorField(null);

    const delta = Math.round((Number(savedSoFar) - goal.savedSoFar) * 100) / 100;
    if (delta === 0) {
      await submitGoal(name, 0, false);
      return;
    }

    setPendingChange({ name, delta });
  }

  const isIncrease = pendingChange !== null && pendingChange.delta > 0;
  const nameId = `${uid}-name`;
  const targetId = `${uid}-target`;
  const recurringId = `${uid}-recurring`;
  const savedId = `${uid}-saved`;
  const errorId = `${uid}-error`;

  return (
    <Sheet visible={visible} title={t.goals.editTitle} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={nameId}>{t.goals.goalNameLabel}</label>
          <CategoryNameInput
            id={nameId}
            name="name"
            categoryNames={categoryNames}
            defaultValue={goal.name}
            showChips={false}
            invalid={errorField === "name"}
            describedBy={errorId}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
            <label htmlFor={targetId}>{t.goals.totalGoalLabel}</label>
            <CurrencyInput
              id={targetId}
              defaultValue={lifetimeTargetAmount}
              onValueChange={setLifetimeTargetAmount}
              className={errorField === "target" ? "is-invalid" : ""}
              invalid={errorField === "target"}
              describedBy={errorField === "target" ? errorId : undefined}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
            <label htmlFor={recurringId}>{t.goals.perCycleLabel}</label>
            <CurrencyInput
              id={recurringId}
              defaultValue={recurringAmount}
              onValueChange={setRecurringAmount}
              allowEmpty
              placeholder={t.goals.optionalPlaceholder}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor={savedId}>{t.goals.alreadySavedLabel}</label>
          <CurrencyInput
            id={savedId}
            defaultValue={savedSoFar}
            onValueChange={setSavedSoFar}
            className={errorField === "saved" ? "is-invalid" : ""}
            invalid={errorField === "saved"}
            describedBy={errorField === "saved" ? errorId : undefined}
          />
        </div>

        {error && (
          <p id={errorId} className="error-text" role="alert">
            {error}
          </p>
        )}

        {pendingChange !== null && (
          <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            {isIncrease
              ? t.goals.increaseConfirm(formatCurrency(pendingChange.delta))
              : t.goals.decreaseConfirm(formatCurrency(Math.abs(pendingChange.delta)))}
          </p>
        )}

        {pendingChange !== null ? (
          <>
            <button
              type="button"
              className="button sheet-submit"
              disabled={pending}
              onClick={() => submitGoal(pendingChange.name, pendingChange.delta, true)}
            >
              {pending ? t.goals.saving : isIncrease ? t.goals.recordAsTransaction : t.goals.recordAsWithdrawal}
            </button>
            <button
              type="button"
              className="button button--secondary sheet-submit"
              disabled={pending}
              onClick={() => submitGoal(pendingChange.name, pendingChange.delta, false)}
            >
              {pending ? t.goals.saving : t.goals.justUpdate}
            </button>
            <button
              type="button"
              className="button button--secondary sheet-submit"
              disabled={pending}
              onClick={() => setPendingChange(null)}
            >
              {t.goals.cancel}
            </button>
          </>
        ) : (
          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? t.goals.saving : t.goals.save}
          </button>
        )}
      </form>

      {pendingChange === null && (
        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleClose}
          disabled={pending}
        >
          {t.goals.cancel}
        </button>
      )}
    </Sheet>
  );
}
