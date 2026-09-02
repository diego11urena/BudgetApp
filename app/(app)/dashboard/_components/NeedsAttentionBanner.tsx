"use client";

import { NeedsAttentionSheet } from "./NeedsAttentionSheet";
import { useSheet } from "../../_components/useSheet";
import type { NeedsAttentionTransaction } from "@/lib/needs-attention";
import { useT } from "@/app/_components/LocaleProvider";

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
  const t = useT().dashboard;
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className="banner banner--action" aria-live="polite" {...triggerProps}>
        <span className="banner-dot" aria-hidden="true" />
        <span>{t.needsAttention(transactions.length)}</span>
        <span className="banner-action-label">{t.review}</span>
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
