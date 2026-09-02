"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../_components/ToastProvider";
import { removeGoalAction, restoreGoalAction } from "../actions";
import { useT } from "@/app/_components/LocaleProvider";

export function RemoveGoalButton({
  categoryId,
  name,
  onRemoved,
}: {
  categoryId: string;
  name: string;
  /** Called right after a successful remove -- lets a caller that's showing this goal in an open sheet (EditGoalSheet) close it, since the goal it was editing no longer exists. */
  onRemoved?: () => void;
}) {
  const t = useT();
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
      onRemoved?.();
      const r = result.removed;
      showToast(t.goals.deleted, {
        label: t.goals.undoRemove,
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
      className="button button--ghost button--ghost-danger"
      aria-label={t.goals.removeAria(name)}
      onClick={handleRemove}
      disabled={pending}
    >
      {pending ? t.goals.removing : t.goals.remove}
    </button>
  );
}
