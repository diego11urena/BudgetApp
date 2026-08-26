"use client";

import { useEffect, useState } from "react";
import { Sheet } from "../../../_components/Sheet";
import { CategoryFormSheet } from "./CategoryFormSheet";
import { MergeCategorySheet } from "./MergeCategorySheet";
import { DeleteCategoryConfirm } from "./DeleteCategoryConfirm";
import type { CategoryWithUsage } from "./types";

/**
 * The first "•••"/overflow-menu in this app (no prior pattern to match) —
 * built as the same bottom-sheet-of-buttons the app already uses
 * everywhere else, rather than a floating dropdown, to stay consistent
 * with the existing idiom.
 */
export function CategoryActionsSheet({
  category,
  otherCategories,
  onDone,
  returnFocusTo,
}: {
  category: CategoryWithUsage;
  otherCategories: CategoryWithUsage[];
  onDone: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"menu" | "edit" | "merge" | "delete">("menu");

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  if (mode === "edit") {
    return (
      <CategoryFormSheet type="EXPENSE" existingCategory={category} onDone={onDone} returnFocusTo={returnFocusTo} />
    );
  }
  if (mode === "merge") {
    return (
      <MergeCategorySheet
        source={category}
        otherCategories={otherCategories}
        onDone={onDone}
        returnFocusTo={returnFocusTo}
      />
    );
  }
  if (mode === "delete") {
    return (
      <DeleteCategoryConfirm type="EXPENSE" category={category} onDone={onDone} returnFocusTo={returnFocusTo} />
    );
  }

  return (
    <Sheet visible={visible} title={category.name} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("edit")}>
        Edit
      </button>
      <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("merge")}>
        Merge into…
      </button>
      <button type="button" className="button button--danger sheet-submit" onClick={() => setMode("delete")}>
        Delete
      </button>
      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
        Cancel
      </button>
    </Sheet>
  );
}
