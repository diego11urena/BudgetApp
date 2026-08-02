"use client";

import { useActionState } from "react";
import { upsertGoalAction, type GoalFormState } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";

const initialState: GoalFormState = undefined;

export function GoalForm({ categoryNames }: { categoryNames: string[] }) {
  const [state, formAction, pending] = useActionState(upsertGoalAction, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="goal-name">Goal name</label>
        <CategoryNameInput
          id="goal-name"
          name="name"
          categoryNames={categoryNames}
          placeholder="Emergency fund"
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
          <label htmlFor="goal-lifetime">Total goal (USD)</label>
          <input
            id="goal-lifetime"
            name="lifetimeTargetAmount"
            type="text"
            inputMode="decimal"
            placeholder="5000.00"
            required
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
          <label htmlFor="goal-recurring">Per-cycle contribution (optional)</label>
          <input
            id="goal-recurring"
            name="recurringAmount"
            type="text"
            inputMode="decimal"
            placeholder="200.00"
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Save goal"}
        </button>
      </div>
      {state?.error && <p className="error-text">{state.error}</p>}
    </form>
  );
}
