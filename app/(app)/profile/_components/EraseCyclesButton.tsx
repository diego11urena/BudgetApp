"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eraseAllCyclesAction } from "../cycle-actions";
import { Sheet } from "../../_components/Sheet";

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
  const [error, setError] = useState<string | null>(null);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await eraseAllCyclesAction();
    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <>
      <button
        type="button"
        className="button button--danger"
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
          error={error}
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
  error,
  onConfirm,
  onCancel,
  returnFocusTo,
}: {
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleCancel() {
    setVisible(false);
    setTimeout(onCancel, 200);
  }

  return (
    <Sheet
      visible={visible}
      title="Erase all cycles?"
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleCancel}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        Permanently deletes every past and current quincena — all transactions, budget targets,
        and income records in them. Your categories and income setup stay intact, and a fresh
        cycle starts right away. This can&apos;t be undone.
      </p>
      {error && (
        <p className="error-text" role="alert" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button--danger sheet-submit"
        onClick={onConfirm}
        disabled={pending}
      >
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
    </Sheet>
  );
}
