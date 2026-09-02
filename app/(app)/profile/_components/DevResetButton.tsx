"use client";

import { useT } from "../../../_components/LocaleProvider";

/**
 * Dev-only, so a plain window.confirm() (not this app's toast+Undo pattern)
 * is the right amount of friction here — resetOnboardingAction deletes
 * whatever cycle is currently open, which for an already-onboarded user is
 * their real, populated ACTIVE cycle, not just an empty draft.
 */
export function DevResetButton({ action }: { action: () => void }) {
  const t = useT();
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(t.profile.devReset.confirm)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="button button--secondary">
        {t.profile.devReset.button}
      </button>
    </form>
  );
}
