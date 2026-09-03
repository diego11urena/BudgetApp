"use client";

import { useActionState, useId, useState } from "react";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { CategoryNameInput } from "@/app/(app)/_components/CategoryNameInput";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { saveGoalStepAction, skipGoalStepAction, type GoalStepFormState } from "../actions";
import { useT, useBudgetFrequency, useVocab } from "@/app/_components/LocaleProvider";

export function GoalStepForm({ savingsCategoryNames }: { savingsCategoryNames: string[] }) {
  const t = useT();
  const vocab = useVocab();
  const budgetFrequency = useBudgetFrequency();
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
          frequency: budgetFrequency,
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
          <label htmlFor={`${uid}-name`}>{t.onboarding.goal.nameLabel}</label>
          <CategoryNameInput
            id={`${uid}-name`}
            name="name"
            categoryNames={savingsCategoryNames}
            placeholder={t.onboarding.goal.namePlaceholder}
            showChips={false}
            required={false}
            onValueChange={setName}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={`${uid}-saved`}>{t.onboarding.goal.alreadySavedLabel}</label>
            <CurrencyInput
              id={`${uid}-saved`}
              name="alreadySavedAmount"
              allowEmpty
              onValueChange={setAlreadySaved}
            />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={`${uid}-target`}>{t.onboarding.goal.targetLabel}</label>
            <CurrencyInput id={`${uid}-target`} name="lifetimeTargetAmount" allowEmpty onValueChange={setTarget} />
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${uid}-per`}>{t.onboarding.goal.perQuincenaLabel(vocab)}</label>
          <CurrencyInput id={`${uid}-per`} name="recurringAmount" allowEmpty onValueChange={setPerQuincena} />
          <span className="field-hint">{t.onboarding.goal.perQuincenaHint}</span>
        </div>

        {projection && !projection.isComplete && projection.etaDate && (
          <div className="goal-step-projection">
            <div className="goal-step-projection-ring" aria-hidden="true">
              <span>{Math.round(projection.percentage)}%</span>
            </div>
            <p>
              {t.onboarding.goal.projection(
                vocab,
                formatCurrency(Number(perQuincena)),
                formatFriendlyDate(projection.etaDate),
              )}
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
            {pending
              ? t.onboarding.goal.saving
              : name.trim()
                ? t.onboarding.goal.createAndFinish
                : t.onboarding.goal.finishSetup}
          </button>
          <button type="button" className="button button--ghost" onClick={handleSkip} disabled={pending || skipping}>
            {skipping ? t.onboarding.goal.finishing : t.onboarding.goal.skip}
          </button>
        </div>
      </form>
    </>
  );
}
