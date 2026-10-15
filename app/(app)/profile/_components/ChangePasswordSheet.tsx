"use client";

import { ChevronRight } from "lucide-react";
import { Sheet } from "../../_components/Sheet";
import { useSheet, useSheetVisibility } from "../../_components/useSheet";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { useT } from "../../../_components/LocaleProvider";

/** "Password" used to be a permanently-visible form on the main Profile screen — now behind this row, opened as a sheet. The form itself is untouched. */
export function ChangePasswordSheet() {
  const { open, triggerProps, sheetProps, close } = useSheet();
  const t = useT();

  return (
    <>
      <button type="button" className="line-item line-item--link" {...triggerProps}>
        <span>{t.profile.changePassword.row}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {open && <ChangePasswordSheetContent {...sheetProps} onClose={close} />}
    </>
  );
}

function ChangePasswordSheetContent({
  returnFocusTo,
  onClose,
}: {
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  const { visible, closeThen } = useSheetVisibility();
  const t = useT();

  function handleClose() {
    closeThen(onClose);
  }

  return (
    <Sheet visible={visible} title={t.profile.changePassword.title} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <ChangePasswordForm />
    </Sheet>
  );
}
