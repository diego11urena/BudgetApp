"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { upsertGoalAction, type GoalFormState } from "../actions";
import { CategoryNameInput } from "../../_components/CategoryNameInput";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { useT } from "@/app/_components/LocaleProvider";

const initialState: GoalFormState = undefined;

export function GoalForm({
  categoryNames,
  onSuccess,
}: {
  categoryNames: string[];
  /** Called once, right after a submit completes with no error — lets a caller close the sheet this form lives in. */
  onSuccess?: () => void;
}) {
  const t = useT();
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
        <label htmlFor="goal-name">{t.goals.goalNameLabel}</label>
        <CategoryNameInput
          id="goal-name"
          name="name"
          categoryNames={categoryNames}
          placeholder={t.goals.goalNamePlaceholder}
          showChips={false}
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
          <label htmlFor="goal-lifetime">{t.goals.totalGoalLabel}</label>
          <CurrencyInput id="goal-lifetime" name="lifetimeTargetAmount" required />
        </div>
        <div className="field" style={{ flex: 1, minWidth: "8rem" }}>
          <label htmlFor="goal-recurring">{t.goals.perCycleLabel}</label>
          <CurrencyInput id="goal-recurring" name="recurringAmount" allowEmpty placeholder={t.goals.perCyclePlaceholder} />
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: hasAlreadySaved ? "0.5rem" : "1rem" }}>
        <input
          type="checkbox"
          checked={hasAlreadySaved}
          onChange={(e) => setHasAlreadySaved(e.target.checked)}
        />
        {t.goals.alreadySavedQuestion}
      </label>
      {hasAlreadySaved && (
        <div className="field">
          <label htmlFor="goal-already-saved">{t.goals.alreadySavedLabel}</label>
          <CurrencyInput id="goal-already-saved" name="alreadySavedAmount" allowEmpty placeholder={t.goals.alreadySavedPlaceholder} />
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? t.goals.saving : t.goals.saveGoal}
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
