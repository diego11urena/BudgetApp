"use client";

import { useState } from "react";
import { useToast } from "../../_components/ToastProvider";
import { deleteBudgetGoalAction, restoreBudgetGoalAction } from "../actions";

export function DeleteBudgetGoalButton({
  goalId,
  categoryName,
}: {
  goalId: string;
  categoryName: string;
}) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    setPending(true);
    const fd = new FormData();
    fd.set("goalId", goalId);
    const result = await deleteBudgetGoalAction(fd);
    setPending(false);

    if (result && "deleted" in result) {
      const d = result.deleted;
      showToast("Deleted", {
        label: "Undo",
        onClick: () => {
          const restoreFd = new FormData();
          restoreFd.set("cycleId", d.cycleId);
          restoreFd.set("expenseCategoryId", d.expenseCategoryId);
          restoreFd.set("targetAmount", String(d.targetAmount));
          void restoreBudgetGoalAction(restoreFd);
        },
      });
    }
  }

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`Remove ${categoryName}'s target for this quincena`}
      onClick={handleDelete}
      disabled={pending}
    >
      {pending ? "Removing..." : "Remove target"}
    </button>
  );
}
