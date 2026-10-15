"use client";

import { useActionState, useState } from "react";
import type { ExpensesFormState } from "../actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { MoneyField } from "@/app/(app)/_components/MoneyField";
import ExplainerBubble from "@/app/(app)/_components/ExplainerBubble";
import { useT } from "@/app/_components/LocaleProvider";

interface ExpenseItemRow {
  id: string;
  name: string;
  amount: string;
  hasFixedDate: boolean;
  dueDay: string;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `expense-${nextId}`;
}

/**
 * Step 2, split into the two groups the recurring model actually has
 * (RecurringExpense.hasFixedDate), rather than one list with a "has a set
 * date" checkbox bolted on.
 *
 * The split is the point of the screen: a Scheduled item is one the app
 * will later check for having been charged on time, an Ongoing one is
 * only noted when the user logs it. Onboarding is where that distinction
 * gets made, so each group states what it means in an explainer bubble
 * (both open on first view) instead of leaving the user to infer it from
 * a checkbox label.
 *
 * Still submits through saveExpensesAction's existing items[] shape --
 * each group just hard-codes its own hasFixedDate instead of carrying a
 * per-row toggle.
 */
export function RecurringExpensesStepForm({
  action,
  initialItems,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
  initialItems: { name: string; amount: string; hasFixedDate: boolean; dueDay: string }[];
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<ExpenseItemRow[]>(() =>
    initialItems.length > 0
      ? initialItems.map((item) => ({ id: makeId(), ...item }))
      : // The seeded example the spec asks for: a Scheduled row the user
        // types over. Its literal English name is a pre-filled VALUE, not
        // a UI label -- whatever is submitted becomes the category name.
        [{ id: makeId(), name: "Rent", amount: "450.00", hasFixedDate: true, dueDay: "1" }],
  );

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.name.trim() && row.amount.trim())
      .map((row) => ({
        name: row.name.trim(),
        targetAmount: row.amount,
        hasFixedDate: row.hasFixedDate,
        ...(row.hasFixedDate && row.dueDay ? { dueDay: Number(row.dueDay) } : {}),
      })),
  );

  function addRow(row: Omit<ExpenseItemRow, "id">) {
    setRows((prev) => [...prev, { id: makeId(), ...row }]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  const scheduled = rows.filter((row) => row.hasFixedDate);
  const ongoing = rows.filter((row) => !row.hasFixedDate);
  const count = rows.filter((row) => row.name.trim() && row.amount.trim()).length;

  function renderRows(group: ExpenseItemRow[]) {
    if (group.length === 0) return null;
    return (
      <div className="expenses-step-list">
        {group.map((row) => (
          <div key={row.id} className="expenses-step-row">
            <div className="expenses-step-row-text">
              <span className="expenses-step-row-name">{row.name || t.onboarding.expenses.untitled}</span>
              <span className="expenses-step-row-meta">
                {row.hasFixedDate
                  ? t.onboarding.expenses.scheduleSummary(true, row.dueDay ? Number(row.dueDay) : null)
                  : t.onboarding.expenses.ongoingMeta}
              </span>
            </div>
            <span className="expenses-step-row-amount">
              {row.amount ? `${row.hasFixedDate ? "" : "~"}$${Number(row.amount).toFixed(2)}` : "—"}
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
        <ExplainerBubble
          heading={t.onboarding.expenses.scheduledHeading}
          label={t.onboarding.expenses.scheduledExplainerAria}
        >
          {t.onboarding.expenses.scheduledExplainer}
        </ExplainerBubble>
        {renderRows(scheduled)}
        <AddRow scheduled onAdd={addRow} />
      </section>

      <section className="expenses-step-group expenses-step-group--divided">
        <ExplainerBubble
          heading={t.onboarding.expenses.ongoingHeading}
          label={t.onboarding.expenses.ongoingExplainerAria}
        >
          {t.onboarding.expenses.ongoingExplainer}
        </ExplainerBubble>
        {renderRows(ongoing)}
        <AddRow scheduled={false} onAdd={addRow} />
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
 * One group's own add controls. Scheduled takes a due day; Ongoing takes
 * a typical amount and no date at all -- which is the whole difference
 * between them, so the two shapes are expressed here rather than behind a
 * conditional on a shared row.
 *
 * Keyed state resets after each add (the inputs are uncontrolled from the
 * parent's perspective), so the fields clear without the parent having to
 * own a draft row per group.
 */
function AddRow({
  scheduled,
  onAdd,
}: {
  scheduled: boolean;
  onAdd: (row: Omit<ExpenseItemRow, "id">) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [formKey, setFormKey] = useState(0);

  function submit() {
    if (!name.trim() || !amount.trim()) return;
    onAdd({ name: name.trim(), amount, hasFixedDate: scheduled, dueDay: scheduled ? dueDay : "" });
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
        <MoneyField
          prefix={scheduled ? "$" : "~$"}
          size="sm"
          className={`expenses-step-amount-field${scheduled ? "" : " expenses-step-amount-field--ongoing"}`}
        >
          <CurrencyInput
            defaultValue=""
            allowEmpty
            onValueChange={setAmount}
            placeholder="0.00"
            ariaLabel={
              scheduled ? t.onboarding.expenses.amountPlaceholder : t.onboarding.expenses.typicalAmountPlaceholder
            }
          />
        </MoneyField>
        {!scheduled && (
          <button type="button" className="expenses-step-add-button" onClick={submit}>
            {t.onboarding.expenses.addButton}
          </button>
        )}
      </div>
      {scheduled && (
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
      )}
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
