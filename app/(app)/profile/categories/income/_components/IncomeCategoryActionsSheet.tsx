"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../../../_components/useModalFocus";
import { CategoryFormSheet } from "../../_components/CategoryFormSheet";
import { MergeCategorySheet } from "../../_components/MergeCategorySheet";
import { DeleteCategoryConfirm } from "../../_components/DeleteCategoryConfirm";
import type { CategoryWithUsage } from "../../_components/types";

/** Income's "•••" menu — Edit, Merge, and Delete, identical in shape and behavior to Expense's CategoryActionsSheet (Savings stays on the Goals page; only the underlying `type` differs). */
export function IncomeCategoryActionsSheet({
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
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  if (mode === "edit") {
    return (
      <CategoryFormSheet type="INCOME" existingCategory={category} onDone={onDone} returnFocusTo={returnFocusTo} />
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
      <DeleteCategoryConfirm type="INCOME" category={category} onDone={onDone} returnFocusTo={returnFocusTo} />
    );
  }

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${category.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>{category.name}</h2>

        <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("edit")}>
          Edit
        </button>
        <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("merge")}>
          Merge into…
        </button>
        <button
          type="button"
          className="button button--danger sheet-submit"
          onClick={() => setMode("delete")}
        >
          Delete
        </button>
        <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
