"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/ToastProvider";
import { removeGoalAction, restoreGoalAction } from "../actions";

export function RemoveGoalButton({ categoryId, name }: { categoryId: string; name: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    setPending(true);
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    const result = await removeGoalAction(fd);
    setPending(false);
    router.refresh();

    if (result && "removed" in result) {
      const r = result.removed;
      showToast("Deleted", {
        label: "Undo",
        onClick: () => {
          const restoreFd = new FormData();
          restoreFd.set("categoryId", r.categoryId);
          restoreFd.set("lifetimeTargetAmount", String(r.lifetimeTargetAmount));
          if (r.currentCycleContribution) {
            restoreFd.set("cycleId", r.currentCycleContribution.cycleId);
            restoreFd.set("targetAmount", String(r.currentCycleContribution.targetAmount));
          }
          restoreGoalAction(restoreFd).then(() => router.refresh());
        },
      });
    }
  }

  return (
    <button
      type="button"
      className="button button--ghost"
      aria-label={`Remove goal: ${name}`}
      onClick={handleRemove}
      disabled={pending}
    >
      {pending ? "Removing..." : "Remove goal"}
    </button>
  );
}
