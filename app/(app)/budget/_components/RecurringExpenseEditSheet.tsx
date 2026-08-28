"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { useToast } from "../../_components/ToastProvider";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import {
  createRecurringExpenseAction,
  deleteRecurringExpenseAction,
  restoreRecurringExpenseAction,
  updateRecurringExpenseAction,
} from "../recurring-actions";

type Frequency = "BIWEEKLY" | "MONTHLY";

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
 * EditGoalSheet convention for dual-mode sheets. `recurring` is only shown
 * when editing -- a brand-new recurring expense always starts recurring,
 * same as categories used to.
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
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "BIWEEKLY");
  const [dueDay, setDueDay] = useState(existing?.dueDay !== null && existing?.dueDay !== undefined ? String(existing.dueDay) : "");
  const [recurring, setRecurring] = useState(existing?.recurring ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const uid = useId();
  const nameId = `${uid}-name`;
  const amountId = `${uid}-amount`;
  const categoryId = `${uid}-category`;
  const frequencyId = `${uid}-frequency`;
  const dueDayId = `${uid}-due-day`;
  const errorId = `${uid}-error`;

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
    if (existing) {
      fd.set("id", existing.id);
      fd.set("recurring", String(recurring));
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
      title={existing ? "Edit recurring expense" : "New recurring expense"}
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
            <input
              id={amountId}
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={errorField === "amount" ? "is-invalid" : ""}
              aria-invalid={errorField === "amount" || undefined}
              aria-describedby={errorField === "amount" ? errorId : undefined}
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
            <label htmlFor={frequencyId}>Frequency</label>
            <select
              id={frequencyId}
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              <option value="BIWEEKLY">Every quincena</option>
              <option value="MONTHLY">Once a month</option>
            </select>
          </div>
          {frequency === "MONTHLY" && (
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

        {existing && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            Carries into next quincena
          </label>
        )}

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
