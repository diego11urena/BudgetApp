"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { upsertGoalAction, type GoalFormState } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import { CurrencyInput } from "../../_components/CurrencyInput";

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
  // Progressive disclosure, same reasoning as QuickAddSheet's custom-
  // category mode: most new goals start at $0 saved, so defaulting to
  // hidden keeps the common case uncluttered instead of asking everyone
  // to consider (and dismiss) a field that's usually irrelevant.
  const [hasAlreadySaved, setHasAlreadySaved] = useState(false);

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
          <CurrencyInput id="goal-lifetime" name="lifetimeTargetAmount" required />
        </div>
        <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
          <label htmlFor="goal-recurring">Per-cycle contribution (optional)</label>
          <CurrencyInput id="goal-recurring" name="recurringAmount" allowEmpty placeholder="200.00" />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: hasAlreadySaved ? "0.5rem" : "1rem" }}>
        <input
          type="checkbox"
          checked={hasAlreadySaved}
          onChange={(e) => setHasAlreadySaved(e.target.checked)}
        />
        Do you already have money saved toward this goal?
      </label>
      {hasAlreadySaved && (
        <div className="field">
          <label htmlFor="goal-already-saved">Already saved (USD)</label>
          <CurrencyInput id="goal-already-saved" name="alreadySavedAmount" allowEmpty placeholder="450.00" />
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Save goal"}
        </button>
      </div>
      {state?.error && (
        <p className="error-text" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
