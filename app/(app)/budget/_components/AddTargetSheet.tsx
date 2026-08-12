"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";
import { BudgetGoalForm } from "./BudgetGoalForm";

/**
 * "Add or update a target" used to live permanently at the bottom of the
 * page — now opened on demand from this button, using the same sheet
 * pattern as every other modal in the app (ConfirmJustGotPaidSheet, etc.).
 */
export function AddTargetSheet({ categoryNames }: { categoryNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="button button--secondary button--small"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        + Add target
      </button>

      {open && (
        <AddTargetSheetContent
          categoryNames={categoryNames}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AddTargetSheetContent({
  categoryNames,
  returnFocusTo,
  onClose,
}: {
  categoryNames: string[];
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
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
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Add or update a fixed expense target"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Add or update a target</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          Sets this quincena&apos;s amount. New categories start Recurring — tap the edit icon on
          a target to stop it from carrying into your next quincena.
        </p>
        <BudgetGoalForm categoryNames={categoryNames} onSuccess={handleClose} />
      </div>
    </div>
  );
}
