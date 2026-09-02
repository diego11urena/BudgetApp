"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/app/_components/LocaleProvider";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card error-boundary">
      <p className="error-boundary-emoji">
        <AlertTriangle size={40} aria-hidden="true" />
      </p>
      <h1>{t.onboarding.error.title}</h1>
      <p className="field-hint">{t.onboarding.error.body}</p>
      <button type="button" className="button" onClick={() => reset()}>
        {t.onboarding.error.retry}
      </button>
    </div>
  );
}
