"use client";

import { useState } from "react";
import { QuickAddSheet } from "../../_components/QuickAddSheet";

export function ContributeButton({
  categoryName,
  expenseCategoryNames,
  savingsCategoryNames,
}: {
  categoryName: string;
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
}) {
  const [open, setOpen] = useState(false);
  // Captured synchronously on click, before the sheet mounts — see
  // QuickAddSheet's returnFocusTo doc comment.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  // This goal's own category first, so the sheet's default selection lands
  // on it instead of whatever's normally most-used.
  const orderedSavingsNames = [
    categoryName,
    ...savingsCategoryNames.filter((name) => name !== categoryName),
  ];

  return (
    <>
      <button
        type="button"
        className="button button--secondary button--small"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        Contribute
      </button>

      {open && (
        <QuickAddSheet
          initialType="SAVINGS"
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={orderedSavingsNames}
          returnFocusTo={triggerElement}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
