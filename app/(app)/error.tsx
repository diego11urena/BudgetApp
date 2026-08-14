"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

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

  return (
    <div className="home-page">
      <div className="dashboard-section error-boundary">
        <p className="error-boundary-emoji">
          <AlertTriangle size={40} aria-hidden="true" />
        </p>
        <h1 className="page-title">Something went wrong</h1>
        <p className="field-hint">
          We hit a snag loading this page. Your data is safe — try again.
        </p>
        <button type="button" className="button" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
