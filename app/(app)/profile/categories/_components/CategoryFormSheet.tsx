"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalFocus } from "../../../_components/useModalFocus";
import { CategoryIcon } from "@/lib/category-icons";
import { createCategoryAction, updateCategoryAction } from "../../category-actions";
import { IconPickerSheet } from "./IconPickerSheet";
import type { CategoryWithUsage } from "./types";

/**
 * Create + edit share one form (optional existingCategory prop pre-fills
 * fields), matching this app's established EditGoalSheet/EditPayInfoSheet
 * convention for dual-mode sheets. Name is required; icon has no required
 * selection — leaving it unset keeps CategoryIcon's existing name-heuristic
 * fallback, exactly how every category looked before this feature existed.
 * Shared identically between Expense and Income (type prop) — Savings goals
 * use their own dedicated flow on the Goals page instead.
 *
 * No color picker here on purpose — every category uses the same neutral
 * icon-background treatment now. `ExpenseCategory.color` still exists in
 * the schema (existing rows that already have one keep rendering it, see
 * CategoryRow/IncomeCategoryRow) and updateCategoryAction/createCategoryAction
 * still accept it, but this form simply never sends it, so it can't be set
 * or changed here anymore.
 */
export function CategoryFormSheet({
  type,
  existingCategory,
  onDone,
  returnFocusTo = null,
}: {
  type: "EXPENSE" | "INCOME";
  existingCategory?: CategoryWithUsage;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(existingCategory?.name ?? "");
  const [icon, setIcon] = useState<string | null>(existingCategory?.icon ?? null);
  const [pickingIcon, setPickingIcon] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name");
      return;
    }
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("name", trimmed);
    if (icon) fd.set("icon", icon);

    let result: { error?: string } | undefined;
    if (existingCategory) {
      fd.set("categoryId", existingCategory.id);
      fd.set("type", type);
      result = await updateCategoryAction(fd);
    } else {
      result = await createCategoryAction(fd);
    }

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  }

  return (
    <>
      <div
        className={`sheet-backdrop ${visible && !pickingIcon ? "is-visible" : ""}`}
        onClick={pickingIcon ? undefined : handleClose}
        role="presentation"
      >
        <div
          ref={sheetRef}
          tabIndex={-1}
          className={`sheet ${visible && !pickingIcon ? "is-open" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={existingCategory ? `Edit ${existingCategory.name}` : "Add category"}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sheet-handle" />
          <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>
            {existingCategory ? "Edit category" : "Add category"}
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className="category-form-icon-row">
              <button
                type="button"
                className="category-form-icon-preview"
                onClick={() => setPickingIcon(true)}
                aria-label="Choose an icon"
              >
                <CategoryIcon name={name || "Category"} icon={icon} size={28} aria-hidden="true" />
              </button>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="category-form-name">Category name</label>
                <input
                  id="category-form-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={error ? "is-invalid" : ""}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "category-form-error" : undefined}
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <p id="category-form-error" className="error-text" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="button sheet-submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </button>
          </form>
          <button
            type="button"
            className="button button--secondary sheet-submit"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </button>
        </div>
      </div>

      {pickingIcon && (
        <IconPickerSheet
          onPick={(pickedName) => {
            setIcon(pickedName);
            setPickingIcon(false);
          }}
          onClose={() => setPickingIcon(false)}
        />
      )}
    </>
  );
}
