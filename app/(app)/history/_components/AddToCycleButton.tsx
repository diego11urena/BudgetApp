"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";

// See BottomNav's own comment -- same lazy-loaded QuickAddSheet, same reason.
const QuickAddSheet = dynamic(() => import("../../_components/QuickAddSheet").then((mod) => mod.QuickAddSheet));

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

/**
 * A past cycle's own "add a transaction" entry point — same QuickAddSheet
 * BottomNav's global "+" FAB opens, just scoped to this specific cycle via
 * targetCycleId instead of wherever today's draft cycle happens to be. The
 * global FAB is untouched and still always means "today," everywhere,
 * including on this page.
 */
export function AddToCycleButton({
  cycleId,
  cycleStartDate,
  expenseCategoryNames,
  savingsCategoryNames,
  incomeCategoryNames,
}: {
  cycleId: string;
  /** "YYYY-MM-DD" — this cycle's periodStart, the new transaction's default date. */
  cycleStartDate: string;
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  incomeCategoryNames: string[];
}) {
  const [quickAddType, setQuickAddType] = useState<TxType | null>(null);
  // Same trigger-capture-on-click pattern BottomNav uses — see QuickAddSheet's
  // returnFocusTo doc comment for why this can't just be derived later.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setQuickAddType("EXPENSE");
        }}
      >
        <Plus size={16} aria-hidden="true" /> Add to this quincena
      </button>

      {quickAddType && (
        <QuickAddSheet
          initialType={quickAddType}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          targetCycleId={cycleId}
          returnFocusTo={triggerElement}
          onClose={() => setQuickAddType(null)}
        />
      )}
    </>
  );
}
