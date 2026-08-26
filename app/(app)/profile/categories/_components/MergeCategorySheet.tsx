"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../../_components/Sheet";
import { mergeCategoryAction } from "../../category-actions";
import type { CategoryWithUsage } from "./types";

/**
 * A dedicated merge flow instead of a permanent per-row control — pick
 * source/target, then a real confirmation naming exactly what moves, before
 * calling the existing (already correct/atomic) mergeCategoryAction.
 * Source and target counts are already in memory (usage stats fetched once
 * for the whole screen), so the confirmation needs no extra round trip.
 */
export function MergeCategorySheet({
  source,
  otherCategories,
  initialTargetId,
  onDone,
  returnFocusTo = null,
}: {
  source: CategoryWithUsage;
  otherCategories: CategoryWithUsage[];
  initialTargetId?: string;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [targetId, setTargetId] = useState(initialTargetId ?? "");
  const [confirming, setConfirming] = useState(Boolean(initialTargetId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const sourceFieldId = `${uid}-source`;
  const targetFieldId = `${uid}-target`;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  const target = otherCategories.find((c) => c.id === targetId);

  async function handleMerge() {
    if (!target) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("sourceCategoryId", source.id);
    fd.set("targetCategoryId", target.id);
    const result = await mergeCategoryAction(fd);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  }

  return (
    <Sheet
      visible={visible}
      title={confirming ? `Merge ${source.name} into ${target?.name}?` : "Merge categories"}
      titleStyle={confirming ? { textAlign: "center", marginBottom: "0.5rem" } : undefined}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      {!confirming ? (
        <>
          <div className="field">
            <label htmlFor={sourceFieldId}>Source category</label>
            <input id={sourceFieldId} type="text" value={source.name} disabled />
          </div>
          <div className="field">
            <label htmlFor={targetFieldId}>Merge into</label>
            <select id={targetFieldId} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Choose a category…</option>
              {otherCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button sheet-submit"
            disabled={!targetId}
            onClick={() => setConfirming(true)}
          >
            Continue
          </button>
          <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            {source.transactionCount > 0
              ? `${source.transactionCount} transaction${source.transactionCount === 1 ? "" : "s"} and all associated budget history will be moved to ${target?.name}.`
              : `Any budget history for ${source.name} will be moved to ${target?.name}.`}{" "}
            This action cannot be undone.
          </p>
          {error && <p className="error-text">{error}</p>}
          <button type="button" className="button sheet-submit" onClick={handleMerge} disabled={pending}>
            {pending ? "Merging..." : "Merge categories"}
          </button>
          <button
            type="button"
            className="button button--secondary sheet-submit"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </>
      )}
    </Sheet>
  );
}
