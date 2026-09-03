"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { useSheet } from "../../_components/useSheet";
import { useT, useVocab } from "../../../_components/LocaleProvider";

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
  const { sheetProps, setTrigger } = useSheet();
  const t = useT();
  const vocab = useVocab();

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        onClick={(e) => {
          setTrigger(e.currentTarget);
          setQuickAddType("EXPENSE");
        }}
      >
        <Plus size={16} aria-hidden="true" /> {t.history.addToQuincena(vocab)}
      </button>

      {quickAddType && (
        <QuickAddSheet
          initialType={quickAddType}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          targetCycleId={cycleId}
          {...sheetProps}
          onClose={() => setQuickAddType(null)}
        />
      )}
    </>
  );
}
