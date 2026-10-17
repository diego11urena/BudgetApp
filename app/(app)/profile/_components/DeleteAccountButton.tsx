"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { deleteAccountAction } from "../actions";
import { ConfirmSheet } from "../../_components/ConfirmSheet";
import { useSheet } from "../../_components/useSheet";
import { useT } from "../../../_components/LocaleProvider";

/** Same confirm-sheet pattern as EraseCyclesButton; on success the action signs out and redirects home. */
export function DeleteAccountButton() {
  const { open: confirming, triggerProps, sheetProps, close } = useSheet();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await deleteAccountAction();
    if (result?.error) {
      setPending(false);
      setError(result.error);
    }
  }

  return (
    <>
      <button type="button" className="line-item line-item--link profile-danger-row" {...triggerProps}>
        <span>
          <span className="line-item-title profile-danger-row-title">{t.profile.deleteAccount.button}</span>
          <span className="field-hint">{t.profile.deleteAccount.hint}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {confirming && (
        <ConfirmSheet
          title={t.profile.deleteAccount.confirmTitle}
          body={t.profile.deleteAccount.confirmBody}
          confirmLabel={t.profile.deleteAccount.yes}
          pendingLabel={t.profile.deleteAccount.deleting}
          cancelLabel={t.profile.deleteAccount.cancel}
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
