"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "../_components/LocaleProvider";

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
    <div className="home-page">
      <div className="dashboard-section error-boundary">
        <p className="error-boundary-emoji">
          <AlertTriangle size={40} aria-hidden="true" />
        </p>
        <h1 className="page-title">{t.onboarding.error.title}</h1>
        <p className="field-hint">{t.common.error.appBody}</p>
        <button type="button" className="button" onClick={() => reset()}>
          {t.onboarding.error.retry}
        </button>
      </div>
    </div>
  );
}
