"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";
import { GoalForm } from "./GoalForm";

/**
 * "Add or update a goal" used to live permanently at the bottom of the
 * page — now opened on demand from this button, using the same sheet
 * pattern as every other modal in the app.
 */
export function AddGoalSheet({ categoryNames }: { categoryNames: string[] }) {
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
        + Add goal
      </button>

      {open && (
        <AddGoalSheetContent
          categoryNames={categoryNames}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AddGoalSheetContent({
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
        aria-label="Add or update a savings goal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Add or update a goal</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          Log a savings transaction under the same name (e.g. &quot;Pro Futuro&quot;) any time and
          it&apos;ll count toward this goal automatically.
        </p>
        <GoalForm categoryNames={categoryNames} onSuccess={handleClose} />
      </div>
    </div>
  );
}
