"use client";

import { NeedsAttentionSheet } from "./NeedsAttentionSheet";
import { useSheet } from "../../_components/useSheet";
import type { NeedsAttentionTransaction } from "@/lib/needs-attention";

export function NeedsAttentionBanner({
  transactions,
  expenseCategoryNames,
  incomeCategoryNames,
  savingsCategoryNames,
}: {
  transactions: NeedsAttentionTransaction[];
  expenseCategoryNames: string[];
  incomeCategoryNames: string[];
  savingsCategoryNames: string[];
}) {
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className="banner banner--action" aria-live="polite" {...triggerProps}>
        <span className="banner-dot" aria-hidden="true" />
        <span>
          {transactions.length} transaction{transactions.length === 1 ? "" : "s"} need
          {transactions.length === 1 ? "s" : ""} more info
        </span>
        <span className="banner-action-label">Review</span>
      </button>

      {open && (
        <NeedsAttentionSheet
          initialTransactions={transactions}
          expenseCategoryNames={expenseCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          {...sheetProps}
          onClose={close}
        />
      )}
    </>
  );
}
