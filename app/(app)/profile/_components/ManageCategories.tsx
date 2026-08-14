"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mergeCategoryAction, renameCategoryAction } from "../category-actions";

export interface ManageableCategory {
  id: string;
  name: string;
  type: "EXPENSE" | "SAVINGS";
}

export function ManageCategories({ categories }: { categories: ManageableCategory[] }) {
  if (categories.length === 0) {
    return <p className="field-hint">No categories yet.</p>;
  }

  return (
    <div className="category-manage-list">
      {categories.map((category) => (
        <CategoryManageRow
          key={category.id}
          category={category}
          otherCategories={categories.filter(
            (c) => c.type === category.type && c.id !== category.id,
          )}
        />
      ))}
    </div>
  );
}

function CategoryManageRow({
  category,
  otherCategories,
}: {
  category: ManageableCategory;
  otherCategories: ManageableCategory[];
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [renamePending, setRenamePending] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [mergeTargetId, setMergeTargetId] = useState("");
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [mergePending, setMergePending] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  async function handleRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) return;
    setRenamePending(true);
    setRenameError(null);
    const fd = new FormData();
    fd.set("categoryId", category.id);
    fd.set("name", trimmed);
    const result = await renameCategoryAction(fd);
    setRenamePending(false);
    if (result?.error) {
      setRenameError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleMerge() {
    if (!mergeTargetId) return;
    setMergePending(true);
    setMergeError(null);
    const fd = new FormData();
    fd.set("sourceCategoryId", category.id);
    fd.set("targetCategoryId", mergeTargetId);
    const result = await mergeCategoryAction(fd);
    setMergePending(false);
    if (result?.error) {
      setMergeError(result.error);
      return;
    }
    router.refresh();
    setConfirmingMerge(false);
  }

  const mergeTargetName = otherCategories.find((c) => c.id === mergeTargetId)?.name;

  return (
    <div className="category-manage-row">
      <div className="category-manage-rename">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={`Rename ${category.name}`}
        />
        <button
          type="button"
          className="button button--secondary button--small"
          onClick={handleRename}
          disabled={renamePending || !name.trim() || name.trim() === category.name}
        >
          {renamePending ? "Saving..." : "Rename"}
        </button>
      </div>
      {renameError && <p className="error-text">{renameError}</p>}

      {otherCategories.length > 0 && !confirmingMerge && (
        <div className="category-manage-merge">
          <select
            value={mergeTargetId}
            onChange={(e) => setMergeTargetId(e.target.value)}
            aria-label={`Merge ${category.name} into`}
          >
            <option value="">Merge into…</option>
            {otherCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={() => setConfirmingMerge(true)}
            disabled={!mergeTargetId}
          >
            Merge
          </button>
        </div>
      )}

      {confirmingMerge && (
        <div className="category-manage-merge-confirm">
          <p className="field-hint">
            Merge &quot;{category.name}&quot; into &quot;{mergeTargetName}&quot;? This moves all its
            transactions and budget history and can&apos;t be undone.
          </p>
          <div className="category-manage-merge-confirm-actions">
            <button
              type="button"
              className="button button--small"
              onClick={handleMerge}
              disabled={mergePending}
            >
              {mergePending ? "Merging..." : "Confirm merge"}
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setConfirmingMerge(false)}
              disabled={mergePending}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {mergeError && <p className="error-text">{mergeError}</p>}
    </div>
  );
}
