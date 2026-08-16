"use client";

import { useActionState, useEffect, useRef } from "react";
import { upsertBudgetGoalAction, type BudgetGoalFormState } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";

const initialState: BudgetGoalFormState = undefined;

export function BudgetGoalForm({
  categoryNames,
  onSuccess,
}: {
  categoryNames: string[];
  /** Called once, right after a submit completes with no error — lets a caller close the sheet this form lives in. */
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(upsertBudgetGoalAction, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  return (
    <form action={formAction}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 2, minWidth: "8rem" }}>
          <label htmlFor="budget-name">Category</label>
          <CategoryNameInput
            id="budget-name"
            name="name"
            categoryNames={categoryNames}
            placeholder="Search or add a category…"
            showChips={false}
            invalid={state?.field === "name"}
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: "7rem" }}>
          <label htmlFor="budget-amount">Amount (USD)</label>
          <input
            id="budget-amount"
            name="targetAmount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            className={state?.field === "targetAmount" ? "is-invalid" : ""}
          />
        </div>
        <div className="field">
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {state?.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
