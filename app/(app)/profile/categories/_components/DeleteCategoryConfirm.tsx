"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../../_components/Sheet";
import { deleteCategoryAction } from "../../category-actions";
import type { CategoryWithUsage } from "./types";

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
      title={`Delete ${category.name}?`}
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleClose}
      closeOnBackdropClick={!pending}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        {hasUsage ? (
          <>
            {category.transactionCount > 0 &&
              `${category.transactionCount} transaction${category.transactionCount === 1 ? "" : "s"} will become Uncategorized. `}
            {category.hasBudgetGoal && "Its budget history will be permanently deleted. "}
            This can&apos;t be undone.
          </>
        ) : (
          `It has no transactions or budget history — this can't be undone.`
        )}
      </p>
      {error && <p className="error-text">{error}</p>}
      <button
        type="button"
        className="button button--danger sheet-submit"
        onClick={handleDelete}
        disabled={pending}
      >
        {pending ? "Deleting..." : "Delete category"}
      </button>
      <button
        type="button"
        className="button button--secondary sheet-submit"
        onClick={handleClose}
        disabled={pending}
      >
        Cancel
      </button>
    </Sheet>
  );
}
