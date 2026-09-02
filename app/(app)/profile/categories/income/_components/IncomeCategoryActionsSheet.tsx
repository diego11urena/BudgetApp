"use client";

import { useEffect, useState } from "react";
import { Sheet } from "../../../../_components/Sheet";
import { CategoryFormSheet } from "../../_components/CategoryFormSheet";
import { MergeCategorySheet } from "../../_components/MergeCategorySheet";
import { DeleteCategoryConfirm } from "../../_components/DeleteCategoryConfirm";
import type { CategoryWithUsage } from "../../_components/types";
import { useT } from "../../../../../_components/LocaleProvider";

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
  const t = useT();

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
    <Sheet visible={visible} title={category.name} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("edit")}>
        {t.profile.categories.actions.edit}
      </button>
      <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("merge")}>
        {t.profile.categories.actions.mergeInto}
      </button>
      <button type="button" className="button button--danger sheet-submit" onClick={() => setMode("delete")}>
        {t.profile.categories.actions.delete}
      </button>
      <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
        {t.profile.categories.actions.cancel}
      </button>
    </Sheet>
  );
}
