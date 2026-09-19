"use client";

import { useActionState, useRef, useState } from "react";
import type { ExpensesFormState } from "../actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
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
 * Replaces RentStepForm's single rent-only question with a general list
 * builder -- see the Balboa design system handoff's Step 2 spec. This is a
 * deliberate reversal of RentStepForm's own history (it replaced an older
 * general list-builder in batch 11.6 for being too much onboarding
 * friction); the new design reintroduces a redesigned version of exactly
 * that pattern. Still submits through saveExpensesAction's existing
 * items[] shape (now with an explicit hasFixedDate + optional dueDay per
 * item, mirroring RecurringExpenseEditSheet's own Scheduled/Ongoing
 * choice -- see budgetLineItemSchema) so a genuinely no-set-date item
 * (Panapass, a haircut) can be entered correctly at onboarding time
 * itself, not only fixed up later on the Recurring tab.
 */
export function RecurringExpensesStepForm({
  action,
  initialItems,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
  initialItems: { name: string; amount: string; hasFixedDate: boolean; dueDay: string }[];
}) {
  const t = useT();
  const SUGGESTIONS = [
    t.onboarding.expenses.suggestions.phone,
    t.onboarding.expenses.suggestions.netflix,
    t.onboarding.expenses.suggestions.spotify,
    t.onboarding.expenses.suggestions.gym,
    t.onboarding.expenses.suggestions.insurance,
  ];
  const [state, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<ExpenseItemRow[]>(() =>
    initialItems.length > 0
      ? initialItems.map((item) => ({ id: makeId(), ...item }))
      : [{ id: makeId(), name: "Rent", amount: "450.00", hasFixedDate: true, dueDay: "1" }],
  );
  // Note: the "Rent" seed row keeps its literal English name -- it's a
  // pre-filled example VALUE the user types over, not a UI label (matching
  // how the actual saved category name works: whatever the user submits).
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addHasFixedDate, setAddHasFixedDate] = useState(false);
  const [addDueDay, setAddDueDay] = useState("");
  const [addFormKey, setAddFormKey] = useState(0);
  const nameFieldRef = useRef<HTMLInputElement>(null);

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

  function addRow(name: string) {
    if (!name.trim() || !addAmount.trim()) return;
    setRows((prev) => [
      ...prev,
      { id: makeId(), name: name.trim(), amount: addAmount, hasFixedDate: addHasFixedDate, dueDay: addDueDay },
    ]);
    setAddName("");
    setAddAmount("");
    setAddHasFixedDate(false);
    setAddDueDay("");
    setAddFormKey((k) => k + 1);
  }

  function addSuggestion(name: string) {
    setAddName(name);
    nameFieldRef.current?.focus();
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  const count = rows.filter((row) => row.name.trim() && row.amount.trim()).length;

  return (
    <form action={formAction}>
      <input type="hidden" name="itemsJson" value={itemsJson} readOnly />

      {rows.length > 0 && (
        <div className="expenses-step-list">
          {rows.map((row) => (
            <div key={row.id} className="expenses-step-row">
              <span className="expenses-step-row-name">{row.name || t.onboarding.expenses.untitled}</span>
              <span className="expenses-step-row-meta">
                {t.onboarding.expenses.scheduleSummary(row.hasFixedDate, row.dueDay ? Number(row.dueDay) : null)}
              </span>
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
      )}

      <div className="expenses-step-add" key={addFormKey}>
        <div className="expenses-step-add-row">
          <input
            ref={nameFieldRef}
            type="text"
            placeholder={t.onboarding.expenses.namePlaceholder}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            aria-label={t.onboarding.expenses.nameAria}
          />
          <CurrencyInput
            defaultValue=""
            allowEmpty
            onValueChange={setAddAmount}
            placeholder={t.onboarding.expenses.amountPlaceholder}
          />
        </div>
        <div className="expenses-step-add-row">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={addHasFixedDate}
              onChange={(e) => {
                setAddHasFixedDate(e.target.checked);
                if (!e.target.checked) setAddDueDay("");
              }}
            />
            {t.onboarding.expenses.hasFixedDateLabel}
          </label>
          {addHasFixedDate && (
            <select
              value={addDueDay}
              onChange={(e) => setAddDueDay(e.target.value)}
              aria-label={t.onboarding.expenses.dueDayAria}
            >
              <option value="">{t.onboarding.expenses.dueDayOption}</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="button button--chip expenses-step-add-button" onClick={() => addRow(addName)}>
            {t.onboarding.expenses.addButton}
          </button>
        </div>
      </div>

      <div className="expenses-step-suggestions">
        {SUGGESTIONS.map((name) => (
          <button
            key={name}
            type="button"
            className="chip-pill"
            onClick={() => addSuggestion(name)}
          >
            {t.onboarding.expenses.suggestionChip(name)}
          </button>
        ))}
      </div>

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
 * A second, independent form (same server action, its own hidden
 * itemsJson="[]") -- keeps "Skip for now" from having to fight the main
 * form's own dynamic itemsJson value for whichever button was actually
 * pressed.
 */
export function RecurringExpensesStepSkipButton({
  action,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
}) {
  const t = useT();
  const [, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="itemsJson" value="[]" readOnly />
      <button type="submit" className="button button--ghost" disabled={pending}>
        {t.onboarding.expenses.skip}
      </button>
    </form>
  );
}
