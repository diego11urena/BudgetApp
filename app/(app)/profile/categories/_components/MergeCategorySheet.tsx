"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../../_components/Sheet";
import { mergeCategoryAction } from "../../category-actions";
import type { CategoryWithUsage } from "./types";
import { useT } from "../../../../_components/LocaleProvider";

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
  const t = useT();

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
      title={
        confirming && target
          ? t.profile.categories.merge.title(source.name, target.name)
          : t.profile.categories.merge.genericTitle
      }
      titleStyle={confirming ? { textAlign: "center", marginBottom: "0.5rem" } : undefined}
      onClose={handleClose}
      returnFocusTo={returnFocusTo}
    >
      {!confirming ? (
        <>
          <div className="field">
            <label htmlFor={sourceFieldId}>{t.profile.categories.merge.sourceLabel}</label>
            <input id={sourceFieldId} type="text" value={source.name} disabled />
          </div>
          <div className="field">
            <label htmlFor={targetFieldId}>{t.profile.categories.merge.targetLabel}</label>
            <select id={targetFieldId} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">{t.profile.categories.merge.chooseOption}</option>
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
            {t.profile.categories.merge.continue}
          </button>
          <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
            {t.profile.categories.merge.cancel}
          </button>
        </>
      ) : (
        <>
          <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            {source.transactionCount > 0
              ? t.profile.categories.merge.bodyWithTx(source.transactionCount, target?.name ?? "")
              : t.profile.categories.merge.bodyNoTx(target?.name ?? "")}
            {t.profile.categories.merge.cannotBeUndone}
          </p>
          {error && <p className="error-text">{error}</p>}
          <button type="button" className="button sheet-submit" onClick={handleMerge} disabled={pending}>
            {pending ? t.profile.categories.merge.merging : t.profile.categories.merge.mergeButton}
          </button>
          <button
            type="button"
            className="button button--secondary sheet-submit"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            {t.profile.categories.merge.cancel}
          </button>
        </>
      )}
    </Sheet>
  );
}
