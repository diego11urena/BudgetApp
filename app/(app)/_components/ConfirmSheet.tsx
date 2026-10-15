"use client";

import type { ReactNode } from "react";
import { Sheet } from "./Sheet";
import { useSheetVisibility } from "./useSheet";

/** The confirm-sheet for a significant, hard-to-undo action (too big for toast+Undo) -- danger button, cancel, inline error. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  pending,
  error,
  onConfirm,
  onCancel,
  returnFocusTo,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const { visible, closeThen } = useSheetVisibility();
  const handleCancel = () => closeThen(onCancel);

  return (
    <Sheet
      visible={visible}
      title={title}
      titleStyle={{ marginBottom: "0.5rem" }}
      onClose={handleCancel}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ marginBottom: "0.5rem" }}>
        {body}
      </p>
      {error && (
        <p className="error-text" role="alert" style={{ marginBottom: "0.5rem" }}>
          {error}
        </p>
      )}
      <button type="button" className="button button--danger sheet-submit" onClick={onConfirm} disabled={pending}>
        {pending ? pendingLabel : confirmLabel}
      </button>
      <button type="button" className="button button--secondary sheet-submit" onClick={handleCancel} disabled={pending}>
        {cancelLabel}
      </button>
    </Sheet>
  );
}
