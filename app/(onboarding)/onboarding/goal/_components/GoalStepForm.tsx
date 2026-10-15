"use client";

import { useActionState, useId, useState } from "react";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { MoneyField } from "@/app/(app)/_components/MoneyField";
import { emphasize } from "@/lib/emphasize-amounts";
import { CategoryNameInput } from "@/app/(app)/_components/CategoryNameInput";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatMonthYear, formatWholeDollars } from "@/lib/format";
import { saveGoalStepAction, skipGoalStepAction, type GoalStepFormState } from "../actions";
import { useT, useBudgetFrequency, useVocab, useLocale } from "@/app/_components/LocaleProvider";

export function GoalStepForm({ savingsCategoryNames }: { savingsCategoryNames: string[] }) {
  const t = useT();
  const locale = useLocale();
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

  // "$150" when the amount is whole (the design's headline form), cents
  // only when the user actually typed some.
  const perAmount = Number(perQuincena || 0);
  const projectionAmount = Number.isInteger(perAmount) ? formatWholeDollars(perAmount) : formatCurrency(perAmount);
  const projectionDate = projection?.etaDate ? formatMonthYear(projection.etaDate, locale) : "";

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

        <div className="field-pair">
          <div className="field">
            <label htmlFor={`${uid}-saved`}>{t.onboarding.goal.alreadySavedLabel}</label>
            <MoneyField>
              <CurrencyInput
                id={`${uid}-saved`}
                name="alreadySavedAmount"
                allowEmpty
                onValueChange={setAlreadySaved}
              />
            </MoneyField>
          </div>
          <div className="field">
            <label htmlFor={`${uid}-target`}>{t.onboarding.goal.targetLabel}</label>
            <MoneyField>
              <CurrencyInput id={`${uid}-target`} name="lifetimeTargetAmount" allowEmpty onValueChange={setTarget} />
            </MoneyField>
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${uid}-per`}>{t.onboarding.goal.perQuincenaLabel(vocab)}</label>
          <MoneyField>
            <CurrencyInput id={`${uid}-per`} name="recurringAmount" allowEmpty onValueChange={setPerQuincena} />
          </MoneyField>
          <span className="field-hint">{t.onboarding.goal.perQuincenaHint}</span>
        </div>

        {projection && !projection.isComplete && projection.etaDate && (
          <div className="goal-step-projection">
            <div className="goal-step-projection-ring" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="19" fill="none" strokeWidth="6" className="goal-step-projection-track" />
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  strokeWidth="6"
                  strokeLinecap="round"
                  className="goal-step-projection-fill"
                  strokeDasharray={2 * Math.PI * 19}
                  strokeDashoffset={2 * Math.PI * 19 * (1 - Math.min(100, Math.max(0, projection.percentage)) / 100)}
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <span>{Math.round(projection.percentage)}%</span>
            </div>
            <p>{emphasize(t.onboarding.goal.projection(vocab, projectionAmount, projectionDate), [projectionAmount, projectionDate])}</p>
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
          <button type="button" className="button button--ghost onboarding-skip" onClick={handleSkip} disabled={pending || skipping}>
            {skipping ? t.onboarding.goal.finishing : t.onboarding.goal.skip}
          </button>
        </div>
      </form>
    </>
  );
}
