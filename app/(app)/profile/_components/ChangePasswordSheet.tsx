"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet } from "../../_components/Sheet";
import { ChangePasswordForm } from "./ChangePasswordForm";

/** "Password" used to be a permanently-visible form on the main Profile screen — now behind this row, opened as a sheet. The form itself is untouched. */
export function ChangePasswordSheet() {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="line-item line-item--link"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        <span>Change password</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {open && (
        <ChangePasswordSheetContent
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
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

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  return (
    <Sheet visible={visible} title="Change password" onClose={handleClose} returnFocusTo={returnFocusTo}>
      <ChangePasswordForm />
    </Sheet>
  );
}
