import type { OnboardingStep } from "../_lib/getOnboardingState";
import { ONBOARDING_STEP_ORDER } from "../_lib/getOnboardingState";

export function StepProgress({ current }: { current: OnboardingStep }) {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(current);

  return (
    <div className="step-progress">
      {ONBOARDING_STEP_ORDER.map((step, index) => (
        <span
          key={step}
          className={
            index < currentIndex ? "is-complete" : index === currentIndex ? "is-active" : ""
          }
        />
      ))}
    </div>
  );
}
