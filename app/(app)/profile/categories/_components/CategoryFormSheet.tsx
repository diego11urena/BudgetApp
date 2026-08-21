"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalFocus } from "../../../_components/useModalFocus";
import { CategoryIcon } from "@/lib/category-icons";
import { createCategoryAction, updateCategoryAction } from "../../category-actions";
import { IconPickerSheet } from "./IconPickerSheet";
import type { CategoryWithUsage } from "./types";

const CATEGORY_COLORS = Array.from({ length: 8 }, (_, i) => `chart-cat-${i + 1}`);

/**
 * Create + edit share one form (optional existingCategory prop pre-fills
 * fields), matching this app's established EditGoalSheet/EditPayInfoSheet
 * convention for dual-mode sheets. Name is required; icon has no required
 * selection — leaving it unset keeps CategoryIcon's existing name-heuristic
 * fallback, exactly how every category looked before this feature existed.
 */
export function CategoryFormSheet({
  existingCategory,
  onDone,
  returnFocusTo = null,
}: {
  existingCategory?: CategoryWithUsage;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(existingCategory?.name ?? "");
  const [icon, setIcon] = useState<string | null>(existingCategory?.icon ?? null);
  const [color, setColor] = useState<string | null>(existingCategory?.color ?? null);
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
    if (color) fd.set("color", color);

    let result: { error?: string } | undefined;
    if (existingCategory) {
      fd.set("categoryId", existingCategory.id);
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
                style={color ? { background: `var(--${color})` } : undefined}
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
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <label>Color (optional)</label>
              <div className="category-color-swatch-row">
                <button
                  type="button"
                  className={`category-color-swatch category-color-swatch--none ${color === null ? "is-selected" : ""}`}
                  onClick={() => setColor(null)}
                  aria-label="No custom color"
                  aria-pressed={color === null}
                />
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`category-color-swatch ${color === c ? "is-selected" : ""}`}
                    style={{ background: `var(--${c})` }}
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    aria-pressed={color === c}
                  />
                ))}
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

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
