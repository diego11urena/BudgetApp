"use client";

import { useEffect } from "react";

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
    <div className="card error-boundary">
      <p className="error-boundary-emoji">⚠️</p>
      <h1>Something went wrong</h1>
      <p className="field-hint">
        We hit a snag setting things up. Nothing you&apos;ve entered so far is lost — try again.
      </p>
      <button type="button" className="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
