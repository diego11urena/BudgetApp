"use client";

import { useActionState } from "react";
import { upsertBudgetGoalAction, type BudgetGoalFormState } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";

const initialState: BudgetGoalFormState = undefined;

export function BudgetGoalForm({ categoryNames }: { categoryNames: string[] }) {
  const [state, formAction, pending] = useActionState(upsertBudgetGoalAction, initialState);

  return (
    <form action={formAction}>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 2, minWidth: "8rem" }}>
          <label htmlFor="budget-name">Category</label>
          <CategoryNameInput
            id="budget-name"
            name="name"
            categoryNames={categoryNames}
            placeholder="Groceries"
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: "7rem" }}>
          <label htmlFor="budget-amount">Target (USD)</label>
          <input
            id="budget-amount"
            name="targetAmount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
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
