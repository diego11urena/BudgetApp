import Link from "next/link";
import type { OnboardingStep } from "../_lib/getOnboardingState";
import { ONBOARDING_STEP_ORDER } from "../_lib/getOnboardingState";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function StepProgress({ current }: { current: OnboardingStep }) {
  const t = getDictionary(await getRequestLocale());
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(current);

  return (
    <div className="step-progress">
      <div className="step-progress-pills">
        {ONBOARDING_STEP_ORDER.map((step, index) => {
          const className =
            index < currentIndex ? "is-complete" : index === currentIndex ? "is-active" : "";

          if (index <= currentIndex && step !== current) {
            return (
              <Link
                key={step}
                href={`/onboarding/${step}`}
                className={className}
                aria-label={t.onboarding.stepBack(t.onboarding.stepNames[step])}
              />
            );
          }

          return <span key={step} className={className} />;
        })}
      </div>
      <span className="step-progress-count">
        {currentIndex + 1} / {ONBOARDING_STEP_ORDER.length}
      </span>
    </div>
  );
}
