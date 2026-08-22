"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus";

/**
 * A reusable one-off explanation surface — the ⓘ-triggered sheet pattern
 * first built for the Fixed/Recurring Expenses screen, generalized so any
 * screen can drop in a short piece of explanatory copy without inventing
 * its own tooltip. Purely presentational: whether it auto-shows once
 * (a "seen" flag) is the caller's concern, same as it always was.
 */
export function InfoTooltip({
  title,
  children,
  dismissLabel = "Got it",
  onClose,
  returnFocusTo = null,
}: {
  title: string;
  children: React.ReactNode;
  dismissLabel?: string;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>{title}</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          {children}
        </p>
        <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
