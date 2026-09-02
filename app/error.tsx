"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "./_components/LocaleProvider";

/**
 * Root-level fallback — catches anything not already handled by a nested
 * segment's own error.tsx (e.g. (app) and (onboarding) each have their
 * own). Renders outside any route group's layout, so it provides its own
 * centering instead of relying on one.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const t = useT();

  return (
    <div className="page-center">
      <div className="card error-boundary">
        <p className="error-boundary-emoji">
          <AlertTriangle size={40} aria-hidden="true" />
        </p>
        <h1>{t.onboarding.error.title}</h1>
        <p className="field-hint">{t.common.error.rootBody}</p>
        <button type="button" className="button" onClick={() => reset()}>
          {t.onboarding.error.retry}
        </button>
      </div>
    </div>
  );
}
