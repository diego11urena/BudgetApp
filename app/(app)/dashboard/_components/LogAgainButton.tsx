"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Repeat } from "lucide-react";
import { useSheet } from "../../_components/useSheet";
import { formatCurrency } from "@/lib/format";
import type { RecentTransactionTemplate } from "@/lib/recent-transaction";

// See BottomNav's own comment -- same lazy-loaded QuickAddSheet, same reason.
const QuickAddSheet = dynamic(() => import("../../_components/QuickAddSheet").then((mod) => mod.QuickAddSheet));

/**
 * The "same as last time" quick-log shortcut (fix-list batch 11.2) — opens
 * QuickAddSheet pre-filled from the user's single most recent transaction
 * (see lib/recent-transaction.ts), so a repeat entry (today's coffee,
 * again) is amount+category typing away instead of a from-scratch form.
 * Requires one more tap (the sheet's own submit button, with everything
 * already reviewable via its auto-expanded "More details") rather than
 * logging instantly on this row's own tap -- a stray tap here shouldn't be
 * able to create a real transaction with no chance to catch it first.
 */
export function LogAgainButton({
  expenseCategoryNames,
  savingsCategoryNames,
  incomeCategoryNames,
  cycleStartDate,
  template,
}: {
  expenseCategoryNames: string[];
  savingsCategoryNames: string[];
  incomeCategoryNames: string[];
  /** "YYYY-MM-DD" — the current cycle's periodStart, same prop QuickAddSheet's other create-mode callers pass. */
  cycleStartDate: string;
  template: RecentTransactionTemplate;
}) {
  const [open, setOpen] = useState(false);
  const { sheetProps, setTrigger } = useSheet();

  return (
    <>
      <button
        type="button"
        className="line-item line-item--link"
        onClick={(e) => {
          setTrigger(e.currentTarget);
          setOpen(true);
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Repeat size={16} aria-hidden="true" />
          Log again: {formatCurrency(template.amount)} · {template.categoryName}
        </span>
      </button>

      {open && (
        <QuickAddSheet
          initialType={template.type}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          prefill={template}
          {...sheetProps}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
