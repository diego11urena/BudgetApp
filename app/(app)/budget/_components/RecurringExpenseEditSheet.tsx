"use client";

import { useId, useState } from "react";
import { useSheetVisibility } from "../../_components/useSheet";
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
 * Two independent controls -- "repeats every cycle" (recurring) and the
 * optional charge date (dueDay) are unrelated questions: a one-time car
 * registration fee still has a real date, and a genuinely recurring
 * haircut still has none.
 */
export interface EditableRecurringExpense {
  id: string;
  name: string;
  targetAmount: number;
  categoryName: string;
  recurring: boolean;
  dueDay: number | null;
}

/**
 * Create + edit share one sheet (optional `existing` prop pre-fills
 * fields and adds Delete), matching this app's established CategoryFormSheet/
 * EditGoalSheet convention for dual-mode sheets.
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
  const { visible, closeThen } = useSheetVisibility();
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? existing.targetAmount.toFixed(2) : "");
  const [recurring, setRecurring] = useState(existing?.recurring ?? true);
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

  function handleClose() {
    closeThen(onDone);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // A plain checkbox below (no name attribute), so its value is set here.
    fd.set("recurring", String(recurring));
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
            <label htmlFor={amountId}>{t.budget.recurringEdit.amountLabel}</label>
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
              invalid={errorField === "categoryName"}
              describedBy={errorId}
            />
          </div>
        </div>

        <div className="field">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            {t.budget.recurringEdit.repeatsLabel}
          </label>
        </div>

        {/* Optional: blank means no set date, and it then always counts as
            charged this cycle. A native select, so iOS shows its own picker. */}
        <div className="field">
          <label htmlFor={dueDayId}>{t.budget.recurringEdit.dueDayLabel}</label>
          <select
            id={dueDayId}
            name="dueDay"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            className={errorField === "dueDay" ? "is-invalid" : ""}
            aria-invalid={errorField === "dueDay" || undefined}
            aria-describedby={errorField === "dueDay" ? errorId : undefined}
          >
            <option value="">{t.budget.recurringEdit.noDueDay}</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {t.budget.recurringEdit.dueDayOption(i + 1)}
              </option>
            ))}
          </select>
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
