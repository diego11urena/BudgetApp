"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../../_components/Sheet";
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
 * No color picker here -- every category uses the same neutral
 * icon-background treatment (ExpenseCategory.color, the field that used to
 * back a per-category swatch color, has been removed entirely: nothing in
 * the UI ever offered a way to set it).
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
  const uid = useId();
  const nameId = `${uid}-name`;
  const errorId = `${uid}-error`;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

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
      <Sheet
        visible={visible && !pickingIcon}
        title={existingCategory ? "Edit category" : "Add category"}
        onClose={handleClose}
        closeOnBackdropClick={!pickingIcon}
        returnFocusTo={returnFocusTo}
      >
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
              <label htmlFor={nameId}>Category name</label>
              <input
                id={nameId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={error ? "is-invalid" : ""}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                autoFocus
              />
            </div>
          </div>

          {error && (
            <p id={errorId} className="error-text" role="alert">
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
      </Sheet>

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
