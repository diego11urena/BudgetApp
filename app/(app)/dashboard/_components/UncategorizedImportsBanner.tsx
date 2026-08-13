"use client";

import { useState } from "react";
import { CategorizeImportsSheet, type UncategorizedTransaction } from "./CategorizeImportsSheet";

export function UncategorizedImportsBanner({
  transactions,
  categoryNames,
}: {
  transactions: UncategorizedTransaction[];
  categoryNames: string[];
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
          {transactions.length === 1 ? "s" : ""} a category
        </span>
        <span aria-hidden="true">→</span>
      </button>

      {open && (
        <CategorizeImportsSheet
          initialTransactions={transactions}
          categoryNames={categoryNames}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
