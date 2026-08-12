"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";
import { IncomeSettingsForm, type IncomeSettingsInitial } from "./IncomeSettingsForm";

/** "Income" used to be a permanently-visible form on the main Profile screen — now behind this row, opened as a sheet. The form itself is untouched. */
export function EditIncomeSheet({ initial }: { initial: IncomeSettingsInitial }) {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="line-item line-item--link"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        <span>Edit income</span>
        <span>›</span>
      </button>

      {open && (
        <EditIncomeSheetContent
          initial={initial}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EditIncomeSheetContent({
  initial,
  returnFocusTo,
  onClose,
}: {
  initial: IncomeSettingsInitial;
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
        aria-label="Edit income"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Edit income</h2>
        <IncomeSettingsForm initial={initial} />
      </div>
    </div>
  );
}
