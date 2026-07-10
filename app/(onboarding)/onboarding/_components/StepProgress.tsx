import Link from "next/link";
import type { OnboardingStep } from "../_lib/getOnboardingState";
import { ONBOARDING_STEP_ORDER } from "../_lib/getOnboardingState";

export function StepProgress({ current }: { current: OnboardingStep }) {
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(current);

  return (
    <div className="step-progress">
      {ONBOARDING_STEP_ORDER.map((step, index) => {
        const className =
          index < currentIndex ? "is-complete" : index === currentIndex ? "is-active" : "";

        if (index <= currentIndex && step !== current) {
          return (
            <Link key={step} href={`/onboarding/${step}`} className={className} aria-label={`Go back to ${step}`} />
          );
        }

        return <span key={step} className={className} />;
      })}
    </div>
  );
}
