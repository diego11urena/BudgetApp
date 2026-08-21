"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalFocus } from "../../../../_components/useModalFocus";
import { renameCategoryAction } from "../../../category-actions";
import type { CategoryWithUsage } from "../../_components/types";

/** Income's simple rename — the existing renameCategoryAction, name-only, no icon/color. */
export function RenameCategorySheet({
  category,
  onDone,
  returnFocusTo = null,
}: {
  category: CategoryWithUsage;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(category.name);
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
    fd.set("categoryId", category.id);
    fd.set("name", trimmed);
    const result = await renameCategoryAction(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  }

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Rename ${category.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Rename category</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="rename-category-name">Category name</label>
            <input
              id="rename-category-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={error ? "is-invalid" : ""}
              autoFocus
            />
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
  );
}
