"use client";

import { useActionState, useEffect, useRef } from "react";
import { upsertGoalAction, type GoalFormState } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";

const initialState: GoalFormState = undefined;

export function GoalForm({
  categoryNames,
  onSuccess,
}: {
  categoryNames: string[];
  /** Called once, right after a submit completes with no error — lets a caller close the sheet this form lives in. */
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(upsertGoalAction, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      onSuccess?.();
    }
    wasPending.current = pending;
  }, [pending, state, onSuccess]);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="goal-name">Goal name</label>
        <CategoryNameInput
          id="goal-name"
          name="name"
          categoryNames={categoryNames}
          placeholder="Search or add a goal…"
          showChips={false}
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
