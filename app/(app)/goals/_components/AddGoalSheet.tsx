"use client";

import { useEffect, useState } from "react";
import { Sheet } from "../../_components/Sheet";
import { useSheet } from "../../_components/useSheet";
import { GoalForm } from "./GoalForm";
import { useT } from "@/app/_components/LocaleProvider";

/**
 * "Add or update a goal" used to live permanently at the bottom of the
 * page — now opened on demand from this button, using the same sheet
 * pattern as every other modal in the app.
 */
export function AddGoalSheet({ categoryNames }: { categoryNames: string[] }) {
  const t = useT();
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className="button button--chip" {...triggerProps}>
        {t.goals.addGoal}
      </button>

      {open && <AddGoalSheetContent categoryNames={categoryNames} {...sheetProps} onClose={close} />}
    </>
  );
}

function AddGoalSheetContent({
  categoryNames,
  returnFocusTo,
  onClose,
}: {
  categoryNames: string[];
  returnFocusTo: HTMLElement | null;
  onClose: () => void;
}) {
  const t = useT();
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
    <Sheet
      visible={visible}
      title={t.goals.addOrUpdate}
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
        {t.goals.logNote}
      </p>
      <GoalForm categoryNames={categoryNames} onSuccess={handleClose} />
    </Sheet>
  );
}
