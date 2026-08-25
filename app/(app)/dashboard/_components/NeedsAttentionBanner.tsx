"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { NeedsAttentionSheet, type NeedsAttentionTransaction } from "./NeedsAttentionSheet";

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
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="banner banner--action"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        <span>
          {transactions.length} transaction{transactions.length === 1 ? "" : "s"} need
          {transactions.length === 1 ? "s" : ""} more info
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {open && (
        <NeedsAttentionSheet
          initialTransactions={transactions}
          expenseCategoryNames={expenseCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
