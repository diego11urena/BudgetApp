"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../../../_components/useModalFocus";
import { RenameCategorySheet } from "./RenameCategorySheet";
import { MergeCategorySheet } from "../../_components/MergeCategorySheet";
import type { CategoryWithUsage } from "../../_components/types";

/** Income's trimmed "•••" menu — Rename and Merge only, per the confirmed scope decision (Savings stays on the Goals page; Income doesn't need the icon/color/delete richness Expense gets). */
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
  const [mode, setMode] = useState<"menu" | "rename" | "merge">("menu");
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

  if (mode === "rename") {
    return <RenameCategorySheet category={category} onDone={onDone} returnFocusTo={returnFocusTo} />;
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

        <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("rename")}>
          Rename
        </button>
        <button type="button" className="button button--secondary sheet-submit" onClick={() => setMode("merge")}>
          Merge into…
        </button>
        <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
