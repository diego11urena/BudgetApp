"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateGoalAction, adjustGoalContributionAction } from "../actions";
import { addTransactionAction } from "../../_actions/transactions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import { useModalFocus } from "../../_components/useModalFocus";
import { formatCurrency } from "@/lib/format";
import { INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";

export interface EditableGoal {
  categoryId: string;
  name: string;
  lifetimeTargetAmount: number;
  currentCycleRecurringAmount: number | null;
  savedSoFar: number;
}

/**
 * Edits an existing goal's name, total target, per-cycle contribution, and
 * "amount saved so far." The first three are a plain field edit
 * (updateGoalAction). The last one is the one field with real accounting
 * implications: savedSoFar is always transactions + manualAdjustment (see
 * lib/goals.ts), never a raw editable number, so changing it here always
 * means changing one of those two terms -- an increase asks whether to
 * record it as a real transaction (money that actually moved just now) or
 * as a correction (manualAdjustment only, doesn't touch transaction
 * history); a decrease is always a correction, since this app's
 * transaction model has no way to represent a savings withdrawal.
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
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  /** Commits the name/target/recurring fields — always runs, regardless of whether savedSoFar changed. */
  async function submitBaseFields(name: string): Promise<string | null> {
    const fd = new FormData();
    fd.set("categoryId", goal.categoryId);
    fd.set("name", name);
    fd.set("lifetimeTargetAmount", lifetimeTargetAmount);
    if (recurringAmount.trim()) fd.set("recurringAmount", recurringAmount);
    const result = await updateGoalAction(undefined, fd);
    return result?.error ?? null;
  }

  async function finishWithTransaction(name: string, delta: number) {
    setPending(true);
    setError(null);
    const baseError = await submitBaseFields(name);
    if (baseError) {
      setPending(false);
      setError(baseError);
      return;
    }
    // Uses the just-submitted `name`, not goal.name -- submitBaseFields
    // above may have just renamed this same category (goal.categoryId),
    // so addTransactionAction's own name-based category lookup
    // (getOrCreateCategory) needs the CURRENT name to land on that same
    // renamed row instead of recreating an orphaned category under the
    // now-stale old name.
    const fd = new FormData();
    fd.set("type", "SAVINGS");
    fd.set("name", name);
    fd.set("amount", delta.toFixed(2));
    const result = await addTransactionAction(undefined, fd);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  }

  async function finishWithAdjustment(name: string, delta: number) {
    setPending(true);
    setError(null);
    const baseError = await submitBaseFields(name);
    if (baseError) {
      setPending(false);
      setError(baseError);
      return;
    }
    const result = await adjustGoalContributionAction(goal.categoryId, delta);
    setPending(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
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
      setError("Give it a name");
      setErrorField("name");
      return;
    }
    if (!lifetimeTargetAmount.trim() || Number.isNaN(Number(lifetimeTargetAmount)) || Number(lifetimeTargetAmount) <= 0) {
      setError(INVALID_AMOUNT_FORMAT_MESSAGE);
      setErrorField("target");
      return;
    }
    if (!savedSoFar.trim() || Number.isNaN(Number(savedSoFar)) || Number(savedSoFar) < 0) {
      setError(INVALID_AMOUNT_FORMAT_MESSAGE);
      setErrorField("saved");
      return;
    }
    setError(null);
    setErrorField(null);

    const delta = Math.round((Number(savedSoFar) - goal.savedSoFar) * 100) / 100;
    if (delta === 0) {
      setPending(true);
      const baseError = await submitBaseFields(name);
      setPending(false);
      if (baseError) {
        setError(baseError);
        return;
      }
      router.refresh();
      handleClose();
      return;
    }

    setPendingChange({ name, delta });
  }

  const isIncrease = pendingChange !== null && pendingChange.delta > 0;

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${goal.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Edit goal</h2>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="edit-goal-name">Goal name</label>
            <CategoryNameInput
              id="edit-goal-name"
              name="name"
              categoryNames={categoryNames}
              defaultValue={goal.name}
              showChips={false}
              invalid={errorField === "name"}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
              <label htmlFor="edit-goal-target">Total goal (USD)</label>
              <input
                id="edit-goal-target"
                type="text"
                inputMode="decimal"
                value={lifetimeTargetAmount}
                onChange={(e) => setLifetimeTargetAmount(e.target.value)}
                className={errorField === "target" ? "is-invalid" : ""}
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
              <label htmlFor="edit-goal-recurring">Per-cycle contribution</label>
              <input
                id="edit-goal-recurring"
                type="text"
                inputMode="decimal"
                placeholder="Optional"
                value={recurringAmount}
                onChange={(e) => setRecurringAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="edit-goal-saved">Amount saved so far</label>
            <input
              id="edit-goal-saved"
              type="text"
              inputMode="decimal"
              value={savedSoFar}
              onChange={(e) => setSavedSoFar(e.target.value)}
              className={errorField === "saved" ? "is-invalid" : ""}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          {pendingChange !== null && (
            <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              {isIncrease
                ? `You're increasing the amount saved toward this goal by ${formatCurrency(pendingChange.delta)}. Would you like to record this as a transaction?`
                : `You're decreasing the amount saved toward this goal by ${formatCurrency(Math.abs(pendingChange.delta))}. This won't affect your transaction history.`}
            </p>
          )}

          {pendingChange !== null ? (
            <>
              {isIncrease && (
                <button
                  type="button"
                  className="button sheet-submit"
                  disabled={pending}
                  onClick={() => finishWithTransaction(pendingChange.name, pendingChange.delta)}
                >
                  {pending ? "Saving..." : "Yes, record as transaction"}
                </button>
              )}
              <button
                type="button"
                className="button button--secondary sheet-submit"
                disabled={pending}
                onClick={() => finishWithAdjustment(pendingChange.name, pendingChange.delta)}
              >
                {pending ? "Saving..." : isIncrease ? "No, just update the goal" : "Continue"}
              </button>
              <button
                type="button"
                className="button button--secondary sheet-submit"
                disabled={pending}
                onClick={() => setPendingChange(null)}
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

        {pendingChange === null && (
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
