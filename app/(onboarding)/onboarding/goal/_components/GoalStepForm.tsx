"use client";

import { useActionState, useId, useState } from "react";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { CategoryNameInput } from "@/app/(app)/_components/CategoryNameInput";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { saveGoalStepAction, skipGoalStepAction, type GoalStepFormState } from "../actions";

export function GoalStepForm({ savingsCategoryNames }: { savingsCategoryNames: string[] }) {
  const [state, formAction, pending] = useActionState<GoalStepFormState, FormData>(saveGoalStepAction, undefined);
  const [skipping, setSkipping] = useState(false);
  const [name, setName] = useState("");
  const [alreadySaved, setAlreadySaved] = useState("");
  const [target, setTarget] = useState("");
  const [perQuincena, setPerQuincena] = useState("");
  const uid = useId();

  const projection =
    target.trim() && perQuincena.trim()
      ? computeGoalProjection({
          savedSoFar: Number(alreadySaved || 0),
          lifetimeTargetAmount: Number(target),
          currentCycleRecurringAmount: Number(perQuincena),
        })
      : null;

  async function handleSkip() {
    setSkipping(true);
    await skipGoalStepAction();
  }

  return (
    <>
      <form action={formAction}>
        <div className="field">
          <label htmlFor={`${uid}-name`}>Goal</label>
          <CategoryNameInput
            id={`${uid}-name`}
            name="name"
            categoryNames={savingsCategoryNames}
            placeholder="Emergency fund"
            showChips={false}
            required={false}
            onValueChange={setName}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={`${uid}-saved`}>Already saved</label>
            <CurrencyInput
              id={`${uid}-saved`}
              name="alreadySavedAmount"
              allowEmpty
              onValueChange={setAlreadySaved}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={`${uid}-target`}>Target</label>
            <CurrencyInput id={`${uid}-target`} name="lifetimeTargetAmount" allowEmpty onValueChange={setTarget} />
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${uid}-per`}>Per quincena</label>
          <CurrencyInput id={`${uid}-per`} name="recurringAmount" allowEmpty onValueChange={setPerQuincena} />
          <span className="field-hint">Sets the amount behind the one-tap Contribute button on Plan.</span>
        </div>

        {projection && !projection.isComplete && projection.etaDate && (
          <div className="goal-step-projection">
            <div className="goal-step-projection-ring" aria-hidden="true">
              <span>{Math.round(projection.percentage)}%</span>
            </div>
            <p>
              At {formatCurrency(Number(perQuincena))} per quincena you&apos;d hit your target around{" "}
              {formatFriendlyDate(projection.etaDate)}.
            </p>
          </div>
        )}

        {!!state && "error" in state && (
          <p className="error-text" role="alert">
            {state.error}
          </p>
        )}

        <div className="form-actions form-actions--stacked">
          <button type="submit" className="button" disabled={pending || skipping}>
            {pending ? "Saving..." : name.trim() ? "Create goal & finish" : "Finish setup"}
          </button>
          <button type="button" className="button button--ghost" onClick={handleSkip} disabled={pending || skipping}>
            {skipping ? "Finishing..." : "Skip for now"}
          </button>
        </div>
      </form>
    </>
  );
}
