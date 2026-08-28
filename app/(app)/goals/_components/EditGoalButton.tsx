"use client";

import { EditGoalSheet, type EditableGoal } from "./EditGoalSheet";
import { useSheet } from "../../_components/useSheet";

export function EditGoalButton({ goal, categoryNames }: { goal: EditableGoal; categoryNames: string[] }) {
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className="button button--secondary button--small" {...triggerProps}>
        Edit
      </button>

      {open && <EditGoalSheet goal={goal} categoryNames={categoryNames} onDone={close} {...sheetProps} />}
    </>
  );
}
