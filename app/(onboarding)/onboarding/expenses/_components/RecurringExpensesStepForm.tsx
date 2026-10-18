"use client";

import { useActionState, useState } from "react";
import type { ExpensesFormState } from "../actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { MoneyField } from "@/app/(app)/_components/MoneyField";
import { useT } from "@/app/_components/LocaleProvider";

interface ExpenseItemRow {
  id: string;
  name: string;
  amount: string;
  /** "" = no set date. */
  dueDay: string;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `expense-${nextId}`;
}

/**
 * Step 2: one list of recurring items, each with an optional charge date
 * (same model as the Plan tab -- see RecurringExpense's schema comment).
 * Submits through saveExpensesAction's items[] shape.
 */
export function RecurringExpensesStepForm({
  action,
  initialItems,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
  initialItems: { name: string; amount: string; dueDay: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<ExpenseItemRow[]>(() =>
    initialItems.length > 0
      ? initialItems.map((item) => ({ id: makeId(), ...item }))
      : // The seeded example the spec asks for: a dated row the user
        // types over. Its literal English name is a pre-filled VALUE, not
        // a UI label -- whatever is submitted becomes the category name.
        [{ id: makeId(), name: "Rent", amount: "450.00", dueDay: "1" }],
  );

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.name.trim() && row.amount.trim())
      .map((row) => ({
        name: row.name.trim(),
        targetAmount: row.amount,
        ...(row.dueDay ? { dueDay: Number(row.dueDay) } : {}),
      })),
  );

  function addRow(row: Omit<ExpenseItemRow, "id">) {
    setRows((prev) => [...prev, { id: makeId(), ...row }]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  const count = rows.filter((row) => row.name.trim() && row.amount.trim()).length;

  function renderRows() {
    if (rows.length === 0) return null;
    return (
      <div className="expenses-step-list">
        {rows.map((row) => (
          <div key={row.id} className="expenses-step-row">
            <div className="expenses-step-row-text">
              <span className="expenses-step-row-name">{row.name || t.onboarding.expenses.untitled}</span>
              <span className="expenses-step-row-meta">
                {t.onboarding.expenses.rowMeta(row.dueDay ? Number(row.dueDay) : null)}
              </span>
            </div>
            <span className="expenses-step-row-amount">
              {row.amount ? `$${Number(row.amount).toFixed(2)}` : "—"}
            </span>
            <button
              type="button"
              className="expenses-step-row-remove"
              aria-label={t.onboarding.expenses.removeAria(row.name)}
              onClick={() => removeRow(row.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="itemsJson" value={itemsJson} readOnly />

      <section className="expenses-step-group">
        {renderRows()}
        <AddRow onAdd={addRow} />
      </section>

      <div className="tip-block">
        <p>
          <strong>{t.onboarding.expenses.tipLabel}</strong> {t.onboarding.expenses.tipBody}
        </p>
      </div>

      {!!state && "error" in state && <p className="error-text">{state.error}</p>}

      <div className="form-actions form-actions--stacked">
        <button type="submit" className="button" disabled={pending}>
          {pending
            ? t.onboarding.expenses.saving
            : count > 0
              ? t.onboarding.expenses.continueWithItems(count)
              : t.onboarding.expenses.continueNoItems}
        </button>
      </div>
    </form>
  );
}

/**
 * The add controls: name, amount, optional charge date. Keyed state resets
 * after each add, so the fields clear without the parent owning a draft row.
 */
function AddRow({ onAdd }: { onAdd: (row: Omit<ExpenseItemRow, "id">) => void }) {
  const t = useT();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [formKey, setFormKey] = useState(0);

  function submit() {
    if (!name.trim() || !amount.trim()) return;
    onAdd({ name: name.trim(), amount, dueDay });
    setName("");
    setAmount("");
    setDueDay("");
    setFormKey((k) => k + 1);
  }

  return (
    <div className="expenses-step-add" key={formKey}>
      <div className="expenses-step-add-row">
        <input
          type="text"
          placeholder={t.onboarding.expenses.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={t.onboarding.expenses.nameAria}
        />
        <MoneyField prefix="$" size="sm" className="expenses-step-amount-field">
          <CurrencyInput
            defaultValue=""
            allowEmpty
            onValueChange={setAmount}
            placeholder="0.00"
            ariaLabel={t.onboarding.expenses.amountPlaceholder}
          />
        </MoneyField>
      </div>
      <div className="expenses-step-add-row">
        <select value={dueDay} onChange={(e) => setDueDay(e.target.value)} aria-label={t.onboarding.expenses.dueDayAria}>
          <option value="">{t.onboarding.expenses.dueDayOption}</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <button type="button" className="expenses-step-add-button" onClick={submit}>
          {t.onboarding.expenses.addButton}
        </button>
      </div>
    </div>
  );
}

/**
 * A second, independent form (same server action, its own hidden
 * itemsJson="[]") -- keeps "Skip" from having to fight the main form's
 * own dynamic itemsJson value for whichever button was actually pressed.
 */
export function RecurringExpensesStepSkipButton({
  action,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
}) {
  const t = useT();
  const [, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="onboarding-skip-form">
      <input type="hidden" name="itemsJson" value="[]" readOnly />
      <button type="submit" className="button button--ghost onboarding-skip" disabled={pending}>
        {t.onboarding.expenses.skip}
      </button>
    </form>
  );
}
