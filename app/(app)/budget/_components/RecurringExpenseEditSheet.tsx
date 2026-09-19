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
import { useT } from "@/app/_components/LocaleProvider";

/**
 * Two independent controls, not one three-way dropdown -- "repeats every
 * cycle" (recurring) and "has a set date" (hasFixedDate) are unrelated
 * questions (see the schema's own doc comment on RecurringExpense): a
 * one-time car registration fee still has a real due date, and a
 * genuinely recurring haircut still has none. The old BIWEEKLY/MONTHLY/
 * ONE_TIME dropdown conflated the two -- recurring=false was folded into
 * the same control that otherwise meant "how often," and dueDay was only
 * ever reachable through MONTHLY.
 */
export interface EditableRecurringExpense {
  id: string;
  name: string;
  targetAmount: number;
  categoryName: string;
  recurring: boolean;
  hasFixedDate: boolean;
  dueDay: number | null;
}

/**
 * Create + edit share one sheet (optional `existing` prop pre-fills
 * fields and adds Delete), matching this app's established CategoryFormSheet/
 * EditGoalSheet convention for dual-mode sheets. Both the "Repeats /
 * One-time" and "Scheduled / Ongoing" choices are available on both create
 * and edit -- e.g. a car registration fee due only this quincena
 * (one-time, but still has a real date) is a real choice at creation too,
 * not just something you'd switch to later.
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
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? existing.targetAmount.toFixed(2) : "");
  const [recurring, setRecurring] = useState(existing?.recurring ?? true);
  const [hasFixedDate, setHasFixedDate] = useState(existing?.hasFixedDate ?? false);
  const [dueDay, setDueDay] = useState(existing?.dueDay !== null && existing?.dueDay !== undefined ? String(existing.dueDay) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const uid = useId();
  const nameId = `${uid}-name`;
  const amountId = `${uid}-amount`;
  const categoryId = `${uid}-category`;
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
    // Both are plain checkboxes below (no name attribute -- see the form
    // markup), so their real values are set here directly instead.
    fd.set("recurring", String(recurring));
    fd.set("hasFixedDate", String(hasFixedDate));
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
      showToast(t.budget.recurringEdit.deleted, {
        label: t.budget.recurringEdit.undo,
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
      title={existing ? t.budget.recurringEdit.titleEdit : t.budget.recurringEdit.titleNew}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={nameId}>{t.budget.recurringEdit.nameLabel}</label>
          <input
            id={nameId}
            name="name"
            type="text"
            placeholder={t.budget.recurringEdit.namePlaceholder}
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
            <label htmlFor={amountId}>
              {hasFixedDate ? t.budget.recurringEdit.amountLabel : t.budget.recurringEdit.typicalAmountLabel}
            </label>
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
            <label htmlFor={categoryId}>{t.budget.recurringEdit.categoryLabel}</label>
            <CategoryNameInput
              id={categoryId}
              name="categoryName"
              categoryNames={categoryNames}
              defaultValue={existing?.categoryName}
              placeholder={t.budget.recurringEdit.categoryPlaceholder}
              showChips={false}
              invalid={errorField === "categoryName"}
              describedBy={errorId}
            />
          </div>
        </div>

        {/* Two independent checkboxes, not one dropdown -- see
            EditableRecurringExpense's own doc comment for why "repeats"
            and "has a set date" don't collapse into a single choice. */}
        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            {t.budget.recurringEdit.repeatsLabel}
          </label>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={hasFixedDate} onChange={(e) => setHasFixedDate(e.target.checked)} />
              {t.budget.recurringEdit.hasFixedDateLabel}
            </label>
          </div>
          {hasFixedDate && (
            <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
              <label htmlFor={dueDayId}>{t.budget.recurringEdit.dueDayLabel}</label>
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
          {pending ? t.budget.recurringEdit.saving : t.budget.recurringEdit.save}
        </button>
      </form>

      {existing && (
        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleDelete}
          disabled={pending}
        >
          {t.budget.recurringEdit.delete}
        </button>
      )}
      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose} disabled={pending}>
        {t.budget.recurringEdit.cancel}
      </button>
    </Sheet>
  );
}
