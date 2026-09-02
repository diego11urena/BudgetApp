"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { eraseAllCyclesAction } from "../cycle-actions";
import { Sheet } from "../../_components/Sheet";
import { useSheet } from "../../_components/useSheet";
import { useT } from "../../../_components/LocaleProvider";

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
      </button>

      {confirming && (
        <EraseCyclesConfirmSheet pending={pending} error={error} onConfirm={handleConfirm} onCancel={close} {...sheetProps} />
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
  const t = useT();

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
      title={t.profile.eraseCycles.confirmTitle}
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleCancel}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        {t.profile.eraseCycles.confirmBody}
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
        {pending ? t.profile.eraseCycles.erasing : t.profile.eraseCycles.yes}
      </button>
      <button
        type="button"
        className="button button--secondary sheet-submit"
        onClick={handleCancel}
        disabled={pending}
      >
        {t.profile.eraseCycles.cancel}
      </button>
    </Sheet>
  );
}
