"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { MergeCategorySheet } from "./MergeCategorySheet";
import type { CategoryWithUsage } from "./types";

export interface DuplicatePairWithUsage {
  a: CategoryWithUsage;
  b: CategoryWithUsage;
}

/**
 * Secondary by design — this whole section sits at the very bottom of the
 * screen, after every primary action (view/search/add/edit), and only
 * renders when findPossibleDuplicates actually found something. Never
 * merges anything itself; "Review →" just opens the same confirm-first
 * merge flow a row's own "Merge into…" uses, pre-filled.
 */
export function CategoryCleanupSection({
  duplicates,
  allCategories,
}: {
  duplicates: DuplicatePairWithUsage[];
  allCategories: CategoryWithUsage[];
}) {
  const [reviewingIndex, setReviewingIndex] = useState<number | null>(null);

  if (duplicates.length === 0) return null;

  const reviewing = reviewingIndex !== null ? duplicates[reviewingIndex] : null;
  // Lower-usage side merges into the higher-usage side by default — the
  // more likely direction of "which one's the typo" — the user can still
  // change targets before the pair is prefilled... actually the pair is
  // fixed here (this section already knows both names), so this only
  // decides which one is source vs. target, not whether to swap them.
  const source = reviewing && reviewing.a.transactionCount <= reviewing.b.transactionCount ? reviewing.a : reviewing?.b;
  const target = reviewing && source === reviewing.a ? reviewing.b : reviewing?.a;

  return (
    <div className="dashboard-section dashboard-section--plain category-cleanup">
      <p className="category-cleanup-title">
        <AlertTriangle size={16} aria-hidden="true" /> {duplicates.length} possible duplicate
        {duplicates.length === 1 ? "" : "s"}
      </p>
      <div className="category-cleanup-list">
        {duplicates.map((pair, i) => (
          <div className="category-cleanup-row" key={`${pair.a.id}-${pair.b.id}`}>
            <span className="category-cleanup-names">
              {pair.a.name} + {pair.b.name}
            </span>
            <button type="button" className="category-cleanup-review" onClick={() => setReviewingIndex(i)}>
              Review →
            </button>
          </div>
        ))}
      </div>

      {reviewing && source && target && (
        <MergeCategorySheet
          source={source}
          otherCategories={allCategories.filter((c) => c.id !== source.id)}
          initialTargetId={target.id}
          onDone={() => setReviewingIndex(null)}
        />
      )}
    </div>
  );
}
