"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../../_components/Sheet";
import { deleteCategoryAction } from "../../category-actions";
import type { CategoryWithUsage } from "./types";
import { useT } from "../../../../_components/LocaleProvider";

/**
 * Delete is allowed regardless of usage (a confirmed product decision) —
 * this confirmation is what actually carries the warning, so its copy
 * changes based on what's really at stake: nothing to lose for an unused
 * category, real consequences spelled out plainly otherwise. Matches
 * EraseCyclesButton's confirm-sheet pattern for irreversible actions.
 */
export function DeleteCategoryConfirm({
  type,
  category,
  onDone,
  returnFocusTo = null,
}: {
  type: "EXPENSE" | "INCOME";
  category: CategoryWithUsage;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("categoryId", category.id);
    fd.set("type", type);
    const result = await deleteCategoryAction(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  }

  const hasUsage = category.transactionCount > 0 || category.hasBudgetGoal;

  return (
    <Sheet
      visible={visible}
      title={t.profile.categories.deleteConfirm.title(category.name)}
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleClose}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        {hasUsage ? (
          <>
            {category.transactionCount > 0 &&
              t.profile.categories.deleteConfirm.willBecomeUncategorized(category.transactionCount)}
            {category.hasBudgetGoal && t.profile.categories.deleteConfirm.budgetHistoryDeleted}
            {t.profile.categories.deleteConfirm.cannotBeUndone}
          </>
        ) : (
          t.profile.categories.deleteConfirm.noHistoryNoUndo
        )}
      </p>
      {error && <p className="error-text">{error}</p>}
      <button
        type="button"
        className="button button--danger sheet-submit"
        onClick={handleDelete}
        disabled={pending}
      >
        {pending ? t.profile.categories.deleteConfirm.deleting : t.profile.categories.deleteConfirm.delete}
      </button>
      <button
        type="button"
        className="button button--secondary sheet-submit"
        onClick={handleClose}
        disabled={pending}
      >
        {t.profile.categories.deleteConfirm.cancel}
      </button>
    </Sheet>
  );
}
