"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { CategorizeImportsSheet, type UncategorizedTransaction } from "./CategorizeImportsSheet";

export function UncategorizedImportsBanner({
  transactions,
  expenseCategoryNames,
  incomeCategoryNames,
  savingsCategoryNames,
}: {
  transactions: UncategorizedTransaction[];
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
          {transactions.length === 1 ? "s" : ""} a category
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      {open && (
        <CategorizeImportsSheet
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
