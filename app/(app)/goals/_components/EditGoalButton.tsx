"use client";

import { useState } from "react";
import { EditGoalSheet, type EditableGoal } from "./EditGoalSheet";

export function EditGoalButton({ goal, categoryNames }: { goal: EditableGoal; categoryNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="button button--secondary button--small"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        Edit
      </button>

      {open && (
        <EditGoalSheet
          goal={goal}
          categoryNames={categoryNames}
          returnFocusTo={triggerElement}
          onDone={() => setOpen(false)}
        />
      )}
    </>
  );
}
