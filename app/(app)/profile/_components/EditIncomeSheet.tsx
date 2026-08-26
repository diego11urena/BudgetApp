"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Sheet } from "../../_components/Sheet";
import { IncomeSettingsForm, type IncomeSettingsInitial } from "./IncomeSettingsForm";

/** "Income" used to be a permanently-visible form on the main Profile screen — now behind this row, opened as a sheet. The form itself is untouched. */
export function EditIncomeSheet({ initial }: { initial: IncomeSettingsInitial }) {
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
        <span>Edit income</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {open && (
        <EditIncomeSheetContent
          initial={initial}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EditIncomeSheetContent({
  initial,
  returnFocusTo,
  onClose,
}: {
  initial: IncomeSettingsInitial;
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
    <Sheet visible={visible} title="Edit income" onClose={handleClose} returnFocusTo={returnFocusTo}>
      <IncomeSettingsForm initial={initial} />
    </Sheet>
  );
}
