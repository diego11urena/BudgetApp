"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eraseAllCyclesAction } from "../cycle-actions";
import { useModalFocus } from "../../_components/useModalFocus";

/**
 * Mass-deleting all cycle history is the same class of "significant,
 * hard-to-undo action" as closing a quincena (see ConfirmJustGotPaidSheet)
 * — too large to make undoable via toast+Undo, so this uses the same
 * confirm-sheet pattern instead of a native confirm().
 */
export function EraseCyclesButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  async function handleConfirm() {
    setPending(true);
    await eraseAllCyclesAction();
    router.push("/dashboard");
  }

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setConfirming(true);
        }}
      >
        Erase all cycles
      </button>

      {confirming && (
        <EraseCyclesConfirmSheet
          pending={pending}
          onConfirm={handleConfirm}
          onCancel={() => setConfirming(false)}
          returnFocusTo={triggerElement}
        />
      )}
    </>
  );
}

function EraseCyclesConfirmSheet({
  pending,
  onConfirm,
  onCancel,
  returnFocusTo,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleCancel() {
    setVisible(false);
    setTimeout(onCancel, 200);
  }

  useModalFocus(sheetRef, handleCancel, returnFocusTo);

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={pending ? undefined : handleCancel}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Erase all cycles"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Erase all cycles?</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          Permanently deletes every past and current quincena — all transactions, budget
          targets, and income records in them. Your categories and income setup stay intact,
          and a fresh cycle starts right away. This can&apos;t be undone.
        </p>
        <button type="button" className="button sheet-submit" onClick={onConfirm} disabled={pending}>
          {pending ? "Erasing..." : "Yes, erase everything"}
        </button>
        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleCancel}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
