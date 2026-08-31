"use client";

import { useActionState, useRef, useState } from "react";
import type { ExpensesFormState } from "../actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";

interface BillRow {
  id: string;
  name: string;
  amount: string;
  dueDay: string;
}

const SUGGESTIONS = ["Phone", "Netflix", "Spotify", "Gym", "Insurance"];

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `bill-${nextId}`;
}

/**
 * Replaces RentStepForm's single rent-only question with a general list
 * builder -- see the Balboa design system handoff's Step 2 spec. This is a
 * deliberate reversal of RentStepForm's own history (it replaced an older
 * general list-builder in batch 11.6 for being too much onboarding
 * friction); the new design reintroduces a redesigned version of exactly
 * that pattern. Still submits through saveExpensesAction's existing
 * items[] shape (now with an optional dueDay per item).
 */
export function BillsStepForm({
  action,
  initialItems,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
  initialItems: { name: string; amount: string; dueDay: string }[];
}) {
  const [state, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);
  const [rows, setRows] = useState<BillRow[]>(() =>
    initialItems.length > 0
      ? initialItems.map((item) => ({ id: makeId(), ...item }))
      : [{ id: makeId(), name: "Rent", amount: "450.00", dueDay: "1" }],
  );
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addDueDay, setAddDueDay] = useState("");
  const [addFormKey, setAddFormKey] = useState(0);
  const nameFieldRef = useRef<HTMLInputElement>(null);

  const itemsJson = JSON.stringify(
    rows
      .filter((row) => row.name.trim() && row.amount.trim())
      .map((row) => ({
        name: row.name.trim(),
        targetAmount: row.amount,
        ...(row.dueDay ? { dueDay: Number(row.dueDay) } : {}),
      })),
  );

  function addRow(name: string) {
    if (!name.trim() || !addAmount.trim()) return;
    setRows((prev) => [...prev, { id: makeId(), name: name.trim(), amount: addAmount, dueDay: addDueDay }]);
    setAddName("");
    setAddAmount("");
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
        <div className="bills-step-list">
          {rows.map((row) => (
            <div key={row.id} className="bills-step-row">
              <span className="bills-step-row-name">{row.name || "Untitled"}</span>
              <span className="bills-step-row-meta">
                Recurring{row.dueDay ? ` · due day ${row.dueDay}` : ""}
              </span>
              <span className="bills-step-row-amount">
                {row.amount ? `$${Number(row.amount).toFixed(2)}` : "—"}
              </span>
              <button
                type="button"
                className="bills-step-row-remove"
                aria-label={`Remove ${row.name || "bill"}`}
                onClick={() => removeRow(row.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bills-step-add" key={addFormKey}>
        <div className="bills-step-add-row">
          <input
            ref={nameFieldRef}
            type="text"
            placeholder="Name"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            aria-label="Bill name"
          />
          <CurrencyInput
            defaultValue=""
            allowEmpty
            onValueChange={setAddAmount}
            placeholder="$ Amount"
          />
        </div>
        <div className="bills-step-add-row">
          <select
            value={addDueDay}
            onChange={(e) => setAddDueDay(e.target.value)}
            aria-label="Due day"
          >
            <option value="">Due day (optional)</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          <button type="button" className="button button--chip bills-step-add-button" onClick={() => addRow(addName)}>
            + Add
          </button>
        </div>
      </div>

      <div className="bills-step-suggestions">
        {SUGGESTIONS.map((name) => (
          <button
            key={name}
            type="button"
            className="chip-pill"
            onClick={() => addSuggestion(name)}
          >
            + {name}
          </button>
        ))}
      </div>

      <div className="tip-block">
        <p>
          <strong>Tip</strong> Connect Gmail from Profile afterward to import transactions
          automatically instead of typing each one in.
        </p>
      </div>

      {!!state && "error" in state && <p className="error-text">{state.error}</p>}

      <div className="form-actions form-actions--stacked">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : count > 0 ? `Continue with ${count} bill${count === 1 ? "" : "s"}` : "Continue"}
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
export function BillsStepSkipButton({
  action,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
}) {
  const [, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);

  return (
    <form action={formAction}>
      <input type="hidden" name="itemsJson" value="[]" readOnly />
      <button type="submit" className="button button--ghost" disabled={pending}>
        Skip for now
      </button>
    </form>
  );
}
