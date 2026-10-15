"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { eraseAllCyclesAction } from "../cycle-actions";
import { ConfirmSheet } from "../../_components/ConfirmSheet";
import { useSheet } from "../../_components/useSheet";
import { useT, useVocab } from "../../../_components/LocaleProvider";

/**
 * Mass-deleting all cycle history is the same class of "significant,
 * hard-to-undo action" as closing a quincena (see ConfirmJustGotPaidSheet)
 * — too large to make undoable via toast+Undo, so this uses the same
 * confirm-sheet pattern instead of a native confirm().
 */
export function EraseCyclesButton() {
  const router = useRouter();
  const { open: confirming, triggerProps, sheetProps, close } = useSheet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const vocab = useVocab();

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
      <button type="button" className="line-item line-item--link profile-danger-row" {...triggerProps}>
        <span>
          <span className="line-item-title profile-danger-row-title">{t.profile.eraseCycles.button}</span>
          <span className="field-hint">{t.profile.eraseCycles.hint}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {confirming && (
        <ConfirmSheet
          title={t.profile.eraseCycles.confirmTitle}
          body={t.profile.eraseCycles.confirmBody(vocab)}
          confirmLabel={t.profile.eraseCycles.yes}
          pendingLabel={t.profile.eraseCycles.erasing}
          cancelLabel={t.profile.eraseCycles.cancel}
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
