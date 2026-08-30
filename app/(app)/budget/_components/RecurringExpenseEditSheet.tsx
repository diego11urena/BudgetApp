"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { useToast } from "../../_components/ToastProvider";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import { CurrencyInput } from "../../_components/CurrencyInput";
import {
  createRecurringExpenseAction,
  deleteRecurringExpenseAction,
  restoreRecurringExpenseAction,
  updateRecurringExpenseAction,
} from "../recurring-actions";

type Frequency = "BIWEEKLY" | "MONTHLY";
/**
 * One choice instead of the three overlapping controls (a `recurring`
 * boolean, a `frequency` enum, and `dueDay`) this sheet used to show
 * separately -- "a recurring expense that doesn't recur" was a real state
 * a user could land in and have to decode. ONE_TIME maps to
 * recurring=false (frequency stored as BIWEEKLY, a moot value since it
 * never carries forward); the other two map to recurring=true with their
 * own frequency.
 */
type RecurrenceChoice = "BIWEEKLY" | "MONTHLY" | "ONE_TIME";

function toChoice(recurring: boolean, frequency: Frequency): RecurrenceChoice {
  return recurring ? frequency : "ONE_TIME";
}

export interface EditableRecurringExpense {
  id: string;
  name: string;
  targetAmount: number;
  categoryName: string;
  recurring: boolean;
  frequency: Frequency;
  dueDay: number | null;
}

/**
 * Create + edit share one sheet (optional `existing` prop pre-fills
 * fields and adds Delete), matching this app's established CategoryFormSheet/
 * EditGoalSheet convention for dual-mode sheets. The recurrence choice
 * (see RecurrenceChoice above) is available on both create and edit --
 * "One-time" is a real, useful choice at creation too (e.g. a car
 * registration fee due only this quincena), not just something you'd
 * switch to later.
 */
export function RecurringExpenseEditSheet({
  categoryNames,
  existing,
  onDone,
  returnFocusTo = null,
}: {
  categoryNames: string[];
  existing?: EditableRecurringExpense;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? existing.targetAmount.toFixed(2) : "");
  const [recurrenceChoice, setRecurrenceChoice] = useState<RecurrenceChoice>(
    toChoice(existing?.recurring ?? true, existing?.frequency ?? "BIWEEKLY"),
  );
  const [dueDay, setDueDay] = useState(existing?.dueDay !== null && existing?.dueDay !== undefined ? String(existing.dueDay) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const uid = useId();
  const nameId = `${uid}-name`;
  const amountId = `${uid}-amount`;
  const categoryId = `${uid}-category`;
  const recurrenceId = `${uid}-recurrence`;
  const dueDayId = `${uid}-due-day`;
  const errorId = `${uid}-error`;

  // Derived from the one visible choice -- frequency defaults to BIWEEKLY
  // for ONE_TIME (a moot value: recurring=false means it never carries
  // forward regardless of what frequency says).
  const recurring = recurrenceChoice !== "ONE_TIME";
  const frequency: Frequency = recurrenceChoice === "MONTHLY" ? "MONTHLY" : "BIWEEKLY";

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
    const fd = new FormData(e.currentTarget);
    // Neither is a real form field anymore -- the recurrence <select>
    // below is purely UI-controlled (its own "One-time" option isn't a
    // real `frequency` value the server understands), so both derived
    // values are set here directly instead.
    fd.set("recurring", String(recurring));
    fd.set("frequency", frequency);
    if (existing) {
      fd.set("id", existing.id);
    }

    setPending(true);
    setError(null);
    setErrorField(null);

    const action = existing ? updateRecurringExpenseAction : createRecurringExpenseAction;
    const result = await action(undefined, fd);

    setPending(false);
    if (result?.error) {
      setError(result.error);
      setErrorField(result.field ?? null);
      return;
    }
    router.refresh();
    handleClose();
  }

  async function handleDelete() {
    if (!existing) return;
    setPending(true);
    const fd = new FormData();
    fd.set("id", existing.id);
    const result = await deleteRecurringExpenseAction(undefined, fd);
    setPending(false);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();

    if (result && "deleted" in result) {
      const d = result.deleted;
      showToast("Deleted", {
        label: "Undo",
        onClick: () => {
          const restoreFd = new FormData();
          restoreFd.set("recurringExpenseId", d.recurringExpenseId);
          restoreFd.set("cycleId", d.cycleId);
          restoreFd.set("targetAmount", String(d.targetAmount));
          restoreRecurringExpenseAction(restoreFd).then(() => router.refresh());
        },
      });
    }
  }

  return (
    <Sheet
      visible={visible}
      title={existing ? "Edit bill" : "New bill"}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            name="name"
            type="text"
            placeholder="Spotify, Netflix, Rent…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errorField === "name" ? "is-invalid" : ""}
            aria-invalid={errorField === "name" || undefined}
            aria-describedby={errorField === "name" ? errorId : undefined}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
            <label htmlFor={amountId}>Amount (USD)</label>
            <CurrencyInput
              id={amountId}
              name="amount"
              defaultValue={amount}
              onValueChange={setAmount}
              className={errorField === "amount" ? "is-invalid" : ""}
              invalid={errorField === "amount"}
              describedBy={errorField === "amount" ? errorId : undefined}
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
            <label htmlFor={categoryId}>Category</label>
            <CategoryNameInput
              id={categoryId}
              name="categoryName"
              categoryNames={categoryNames}
              defaultValue={existing?.categoryName}
              placeholder="Search or add a category…"
              showChips={false}
              invalid={errorField === "categoryName"}
              describedBy={errorId}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
            <label htmlFor={recurrenceId}>Recurrence</label>
            {/* No name attribute -- "ONE_TIME" isn't a real `frequency`
                value the server understands (it's recurring=false;
                frequency itself is moot then). handleSubmit sets both
                derived fields on the FormData directly instead. */}
            <select
              id={recurrenceId}
              value={recurrenceChoice}
              onChange={(e) => setRecurrenceChoice(e.target.value as RecurrenceChoice)}
            >
              <option value="BIWEEKLY">Every quincena</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ONE_TIME">One-time</option>
            </select>
          </div>
          {recurrenceChoice === "MONTHLY" && (
            <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
              <label htmlFor={dueDayId}>Due day (1–31)</label>
              <input
                id={dueDayId}
                name="dueDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className={errorField === "dueDay" ? "is-invalid" : ""}
                aria-invalid={errorField === "dueDay" || undefined}
                aria-describedby={errorField === "dueDay" ? errorId : undefined}
              />
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button sheet-submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </form>

      {existing && (
        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleDelete}
          disabled={pending}
        >
          Delete
        </button>
      )}
      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose} disabled={pending}>
        Cancel
      </button>
    </Sheet>
  );
}
