"use client";

const CONFIRM_MESSAGE =
  "This permanently deletes your CURRENT cycle — every transaction, income entry, and " +
  "budget/goal target logged in it — and sends you back to onboarding. This cannot be undone. Continue?";

/**
 * Dev-only, so a plain window.confirm() (not this app's toast+Undo pattern)
 * is the right amount of friction here — resetOnboardingAction deletes
 * whatever cycle is currently open, which for an already-onboarded user is
 * their real, populated ACTIVE cycle, not just an empty draft.
 */
export function DevResetButton({ action }: { action: () => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(CONFIRM_MESSAGE)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="button button--secondary">
        Reset onboarding (dev only)
      </button>
    </form>
  );
}
