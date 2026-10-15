"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCycleAction } from "../../profile/cycle-actions";
import { Sheet } from "../../_components/Sheet";
import { useSheet } from "../../_components/useSheet";
import { useT, useVocab } from "../../../_components/LocaleProvider";

/** Same confirm-sheet pattern as EraseCyclesButton: deleting a cycle's data is too big to undo via toast. */
export function DeleteCycleButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const { open: confirming, triggerProps, sheetProps, close } = useSheet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await deleteCycleAction(cycleId);
    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }
    router.push("/history");
  }

  return (
    <>
      <button type="button" className="button button--secondary" {...triggerProps}>
        {t.history.deleteCycle.button}
      </button>
      {confirming && (
        <DeleteCycleConfirmSheet pending={pending} error={error} onConfirm={handleConfirm} onCancel={close} {...sheetProps} />
      )}
    </>
  );
}

function DeleteCycleConfirmSheet({
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
  const t = useT();
  const vocab = useVocab();

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
      title={t.history.deleteCycle.confirmTitle}
      titleStyle={{ marginBottom: "0.5rem" }}
      onClose={handleCancel}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
        {t.history.deleteCycle.confirmBody(vocab)}
      </p>
      {error && (
        <p className="error-text" role="alert" style={{ marginBottom: "0.5rem" }}>
          {error}
        </p>
      )}
      <button type="button" className="button button--danger sheet-submit" onClick={onConfirm} disabled={pending}>
        {pending ? t.history.deleteCycle.deleting : t.history.deleteCycle.yes}
      </button>
      <button type="button" className="button button--secondary sheet-submit" onClick={handleCancel} disabled={pending}>
        {t.history.deleteCycle.cancel}
      </button>
    </Sheet>
  );
}
