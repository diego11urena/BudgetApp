"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCycleAction } from "../../profile/cycle-actions";
import { ConfirmSheet } from "../../_components/ConfirmSheet";
import { useSheet } from "../../_components/useSheet";
import { useT, useVocab } from "../../../_components/LocaleProvider";

/** Same confirm-sheet pattern as EraseCyclesButton: deleting a cycle's data is too big to undo via toast. */
export function DeleteCycleButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const { open: confirming, triggerProps, sheetProps, close } = useSheet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const vocab = useVocab();

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
        <ConfirmSheet
          title={t.history.deleteCycle.confirmTitle}
          body={t.history.deleteCycle.confirmBody(vocab)}
          confirmLabel={t.history.deleteCycle.yes}
          pendingLabel={t.history.deleteCycle.deleting}
          cancelLabel={t.history.deleteCycle.cancel}
          pending={pending}
          error={error}
          onConfirm={handleConfirm}
          onCancel={close}
          {...sheetProps}
        />
      )}
    </>
  );
}
