"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet } from "../../_components/Sheet";
import { useSheet } from "../../_components/useSheet";
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
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <Sheet visible={visible} title={t.profile.changePassword.title} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <ChangePasswordForm />
    </Sheet>
  );
}
